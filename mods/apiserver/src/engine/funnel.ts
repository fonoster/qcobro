import { isSameLocalDay, type AccountDecision, type AccountDecisionEntry } from "@qcobro/common";

/** Per-campaign attempt caps the funnel enforces. */
export interface FunnelCampaign {
  maxAttemptsPerAccount: number;
  maxAttemptsPerDay: number;
}

/** Campaign-local attempt state for one account (absent = never attempted). */
export interface FunnelAccountState {
  attemptCount: number;
  attemptsToday: number;
  lastAttemptAt: Date | null;
  suppressUntil: Date | null;
}

/** A candidate account plus the signals the funnel needs. */
export interface FunnelAccount {
  portfolioAccountId: string;
  phone: string | null;
  email: string | null;
  /** Global, cross-campaign suppression. */
  intentStatus: string | null;
  accountSuppressUntil: Date | null;
  /** Campaign-local state for this `(campaign, account)`, or null if none yet. */
  state: FunnelAccountState | null;
}

export interface FunnelResult {
  /** Accounts to dispatch, ordered least-recently-attempted first (stable). */
  eligible: FunnelAccount[];
  /** Excluded accounts with the reason (for the tick report). */
  decisions: AccountDecisionEntry[];
}

const GLOBAL_SUPPRESSED = new Set(["INTENT_MET", "WRONG_NUMBER", "OPT_OUT"]);

/**
 * Pure eligibility funnel: classifies each candidate and returns the ordered eligible
 * set plus a decision/reason for everyone excluded. Order is least-recently-attempted
 * first (`lastAttemptAt` asc, never-attempted first) with a stable `portfolioAccountId`
 * tiebreaker, so selection is deterministic. The daily count is derived from the local
 * date of `lastAttemptAt` (no reset job).
 */
export function runFunnel(
  campaign: FunnelCampaign,
  accounts: FunnelAccount[],
  now: Date,
  timeZone: string,
  /** EMAIL campaigns require an email address; all other channels require a phone. */
  requiresEmail = false
): FunnelResult {
  const eligible: FunnelAccount[] = [];
  const decisions: AccountDecisionEntry[] = [];

  const exclude = (portfolioAccountId: string, decision: AccountDecision) =>
    decisions.push({ portfolioAccountId, decision });

  for (const a of accounts) {
    if (requiresEmail ? !a.email : !a.phone) {
      exclude(a.portfolioAccountId, requiresEmail ? "no_email" : "no_phone");
      continue;
    }
    if (a.intentStatus && GLOBAL_SUPPRESSED.has(a.intentStatus)) {
      exclude(a.portfolioAccountId, "intent_suppressed");
      continue;
    }
    if (a.accountSuppressUntil && a.accountSuppressUntil > now) {
      exclude(a.portfolioAccountId, "account_suppressed");
      continue;
    }
    const s = a.state;
    if (s?.suppressUntil && s.suppressUntil > now) {
      exclude(a.portfolioAccountId, "promise_suppressed");
      continue;
    }
    if (s && s.attemptCount >= campaign.maxAttemptsPerAccount) {
      exclude(a.portfolioAccountId, "lifetime_cap");
      continue;
    }
    const today =
      s?.lastAttemptAt && isSameLocalDay(s.lastAttemptAt, now, timeZone) ? s.attemptsToday : 0;
    if (today >= campaign.maxAttemptsPerDay) {
      exclude(a.portfolioAccountId, "daily_cap");
      continue;
    }
    eligible.push(a);
  }

  eligible.sort((x, y) => {
    const xt = x.state?.lastAttemptAt?.getTime() ?? -Infinity;
    const yt = y.state?.lastAttemptAt?.getTime() ?? -Infinity;
    if (xt !== yt) return xt - yt;
    return x.portfolioAccountId < y.portfolioAccountId ? -1 : 1;
  });

  return { eligible, decisions };
}
