import {
  buildOutreachContext,
  type AccountDecision,
  type CampaignTickReport,
  type Clock,
  type DispatchOutreachInput,
  type EmailClient,
  type EngineChannel,
  type OutboundCallClient,
  type PortfolioAccountRecord,
  type SmsClient,
  type TickReport
} from "@qcobro/common";
import { createDispatchOutreach } from "../functions/outreach/dispatchOutreach.js";
import { createReserveAttempt } from "../functions/campaigns/reserveAttempt.js";
import { createRecordOutcome } from "../functions/campaigns/recordOutcome.js";
import { createGetWorkspaceSettings } from "../functions/workspaceSettings/getWorkspaceSettings.js";
import { isInWindow, isPastEndDate, type WindowCampaign } from "./window.js";
import { runFunnel, type FunnelAccount } from "./funnel.js";
import { createTokenBucket, perTickCapacity, type TokenBucket } from "./buckets.js";

/** Agent template with the dispatch configs the engine needs. */
export interface EngineTemplate {
  type: string;
  voiceAiConfig: {
    fonosterAppRef: string | null;
    systemPrompt: string;
    firstMessage: string | null;
  } | null;
  voicePrerecordedConfig: { fonosterAppRef: string | null; script: string } | null;
  smsConfig: { messageBody: string } | null;
  emailConfig: {
    subject: string;
    messageBody: string;
    systemPrompt: string;
    maxReplies: number | null;
  } | null;
}

/** A campaign as the engine loads it (schedule + caps + template + portfolios). */
export interface EngineCampaign extends WindowCampaign {
  id: string;
  workspaceRef: string;
  maxAttemptsPerAccount: number;
  maxAttemptsPerDay: number;
  agentTemplate: EngineTemplate | null;
  portfolios: { portfolioId: string }[];
}

/** A candidate account with its campaign-local state (filtered to the campaign). */
export interface EngineCandidate {
  id: string;
  phone: string | null;
  email: string | null;
  intentStatus: string | null;
  suppressUntil: Date | null;
  outstandingBalance: number;
  campaignStates: {
    attemptCount: number;
    attemptsToday: number;
    lastAttemptAt: Date | null;
    suppressUntil: Date | null;
  }[];
}

/** The DB surface the engine reads — satisfied structurally by the Prisma client. */
export interface EngineClient {
  listActiveCampaigns(): Promise<EngineCampaign[]>;
  listCandidates(campaignId: string, portfolioIds: string[]): Promise<EngineCandidate[]>;
  completeCampaign(id: string): Promise<void>;
}

export interface EngineDeps {
  db: EngineClient;
  /** Same client the reserve/record functions use (the Prisma client). */
  reserveRecordClient: unknown;
  outboundCallClient: OutboundCallClient | null;
  smsClient: SmsClient | null;
  emailClient?: EmailClient | null;
  emailFrom?: { email: string; name?: string; inboundDomain: string } | null;
  fonosterNumbers: string[];
  twilioFromNumbers: string[];
  fonosterPrerecordedAppRef: string | null;
  clock: Clock;
  voicePerMinute: number;
  smsPerMinute: number;
  emailPerMinute: number;
  tickSeconds: number;
  /** Hard cap on dispatches per tick across all campaigns (keeps ticks bounded). */
  perTickMax?: number;
}

type Readiness =
  | { ok: true; channel: EngineChannel; appRef: string | null }
  | { ok: false; reason: NonNullable<CampaignTickReport["skipReason"]> };

const VOICE = new Set(["VOICE_AI", "VOICE_PRERECORDED"]);

function channelOf(type: string | undefined): EngineChannel | null {
  if (type === "VOICE_AI" || type === "VOICE_PRERECORDED" || type === "SMS" || type === "EMAIL")
    return type;
  return null;
}

export function createEngine(deps: EngineDeps) {
  const dispatch = createDispatchOutreach({
    outboundCallClient: deps.outboundCallClient,
    smsClient: deps.smsClient,
    emailClient: deps.emailClient,
    emailFrom: deps.emailFrom,
    fonosterNumbers: deps.fonosterNumbers,
    twilioFromNumbers: deps.twilioFromNumbers,
    pickNumber: undefined
  });
  const record = createRecordOutcome(deps.reserveRecordClient as never);
  // Per-workspace timezone + currency, resolved once per campaign per tick. A workspace
  // without a settings row is seeded on read via the column defaults.
  const getSettings = createGetWorkspaceSettings(deps.reserveRecordClient as never);

  /** Channel readiness for a campaign (Topic 5 tier A — catches config up-front). */
  function readiness(c: EngineCampaign): Readiness {
    const type = c.agentTemplate?.type;
    const channel = channelOf(type);
    if (!channel) return { ok: false, reason: "channel_not_supported" };
    if (channel === "SMS") {
      if (!deps.smsClient) return { ok: false, reason: "channel_not_configured" };
      if (deps.twilioFromNumbers.length === 0) return { ok: false, reason: "empty_number_pool" };
      return { ok: true, channel, appRef: null };
    }
    if (channel === "EMAIL") {
      if (!deps.emailClient || !deps.emailFrom) {
        return { ok: false, reason: "channel_not_configured" };
      }
      return { ok: true, channel, appRef: null };
    }
    if (!deps.outboundCallClient) return { ok: false, reason: "channel_not_configured" };
    if (deps.fonosterNumbers.length === 0) return { ok: false, reason: "empty_number_pool" };
    const appRef =
      channel === "VOICE_AI"
        ? (c.agentTemplate?.voiceAiConfig?.fonosterAppRef ?? null)
        : deps.fonosterPrerecordedAppRef;
    if (!appRef) return { ok: false, reason: "voice_not_synced" };
    return { ok: true, channel, appRef };
  }

  /** Build the normalized dispatch request for an account (configs are pre-validated). */
  function buildRequest(
    c: EngineCampaign,
    acc: EngineCandidate,
    channel: EngineChannel,
    appRef: string | null,
    currency: string
  ): DispatchOutreachInput {
    const context = buildOutreachContext(acc as unknown as PortfolioAccountRecord, { currency });
    const t = c.agentTemplate!;
    if (channel === "SMS") {
      return { channel, to: acc.phone!, context, body: t.smsConfig?.messageBody ?? "" };
    }
    if (channel === "EMAIL") {
      return {
        channel,
        to: acc.email!,
        context,
        subject: t.emailConfig?.subject ?? "",
        body: t.emailConfig?.messageBody ?? ""
      };
    }
    if (channel === "VOICE_AI") {
      return {
        channel,
        to: acc.phone!,
        context,
        appRef: appRef ?? undefined,
        firstMessage: t.voiceAiConfig?.firstMessage ?? undefined
      };
    }
    return {
      channel,
      to: acc.phone!,
      context,
      appRef: appRef ?? undefined,
      firstMessage: t.voicePrerecordedConfig?.script
    };
  }

  /** Reserve (before send) → dispatch → record. Returns the per-account decision. */
  async function reserveAndDispatch(
    c: EngineCampaign,
    acc: EngineCandidate,
    channel: EngineChannel,
    appRef: string | null,
    reserve: ReturnType<typeof createReserveAttempt>,
    currency: string
  ): Promise<{ decision: AccountDecision; providerRef?: string }> {
    const at = deps.clock.now().toISOString();
    await reserve({ campaignId: c.id, portfolioAccountId: acc.id, at });

    let result;
    try {
      result = await dispatch(buildRequest(c, acc, channel, appRef, currency));
    } catch (err) {
      // Attempt stays consumed (at-most-once); no gestión for a failed dispatch.
      // Surface the reason — a swallowed dispatch error is undebuggable in prod.
      console.error(
        `[engine] dispatch failed campaign=${c.id} account=${acc.id} channel=${channel}:`,
        err instanceof Error ? err.message : err
      );
      return { decision: "dispatch_failed" };
    }

    await record({
      portfolioAccountId: acc.id,
      campaignId: c.id,
      agentType: channel,
      contactedAt: at,
      outcome: "OTHER",
      debtAmountSnapshot: acc.outstandingBalance,
      providerRef: result.providerRef,
      channelData: { from: result.from, to: result.to, messageBody: result.renderedBody }
    });
    return { decision: "dispatched", providerRef: result.providerRef };
  }

  function toFunnelAccount(acc: EngineCandidate): FunnelAccount {
    const state = acc.campaignStates[0] ?? null;
    return {
      portfolioAccountId: acc.id,
      phone: acc.phone,
      email: acc.email,
      intentStatus: acc.intentStatus,
      accountSuppressUntil: acc.suppressUntil,
      state
    };
  }

  async function tick(): Promise<TickReport> {
    const now = deps.clock.now();
    const buckets: Record<"voice" | "sms" | "email", TokenBucket> = {
      voice: createTokenBucket(perTickCapacity(deps.voicePerMinute, deps.tickSeconds)),
      sms: createTokenBucket(perTickCapacity(deps.smsPerMinute, deps.tickSeconds)),
      email: createTokenBucket(perTickCapacity(deps.emailPerMinute, deps.tickSeconds))
    };
    const usage = {
      VOICE_AI: { dispatched: 0, budget: 0 },
      VOICE_PRERECORDED: { dispatched: 0, budget: 0 },
      SMS: { dispatched: 0, budget: buckets.sms.remaining() },
      EMAIL: { dispatched: 0, budget: buckets.email.remaining() }
    };
    const voiceBudget = buckets.voice.remaining();
    usage.VOICE_AI.budget = voiceBudget;
    usage.VOICE_PRERECORDED.budget = voiceBudget;

    const report: TickReport = { at: now.toISOString(), campaigns: [], channelUsage: {} };
    let totalDispatched = 0;

    for (const c of await deps.db.listActiveCampaigns()) {
      const cr: CampaignTickReport = {
        campaignId: c.id,
        inWindow: false,
        decisions: [],
        dispatched: 0,
        suppressed: 0,
        skipped: 0
      };

      // Resolve this campaign's workspace settings once; its timezone drives the
      // wall-clock window + daily-cap reset, its currency the rendered templates.
      const ws = await getSettings(c.workspaceRef);
      const tz = ws.timezone;
      const reserve = createReserveAttempt(deps.reserveRecordClient as never, tz);

      if (isPastEndDate(c, now, tz)) {
        await deps.db.completeCampaign(c.id);
        cr.completed = true;
        report.campaigns.push(cr);
        continue;
      }

      const win = isInWindow(c, now, tz);
      if (!win.ok) {
        cr.skipReason = win.reason;
        report.campaigns.push(cr);
        continue;
      }
      cr.inWindow = true;

      const ready = readiness(c);
      if (!ready.ok) {
        cr.skipReason = ready.reason;
        report.campaigns.push(cr);
        continue;
      }

      const candidates = await deps.db.listCandidates(
        c.id,
        c.portfolios.map((p) => p.portfolioId)
      );
      const { eligible, decisions } = runFunnel(
        c,
        candidates.map(toFunnelAccount),
        now,
        tz,
        ready.channel === "EMAIL"
      );
      const candidateById = new Map(candidates.map((a) => [a.id, a]));

      for (const d of decisions) {
        cr.decisions.push(d);
        cr.suppressed += 1;
      }

      const bucket = VOICE.has(ready.channel)
        ? buckets.voice
        : ready.channel === "EMAIL"
          ? buckets.email
          : buckets.sms;
      for (const fa of eligible) {
        if (deps.perTickMax !== undefined && totalDispatched >= deps.perTickMax) {
          cr.decisions.push({
            portfolioAccountId: fa.portfolioAccountId,
            decision: "budget_exhausted"
          });
          cr.skipped += 1;
          continue;
        }
        if (!bucket.tryTake()) {
          cr.decisions.push({
            portfolioAccountId: fa.portfolioAccountId,
            decision: "budget_exhausted"
          });
          cr.skipped += 1;
          continue;
        }
        const acc = candidateById.get(fa.portfolioAccountId)!;
        const { decision, providerRef } = await reserveAndDispatch(
          c,
          acc,
          ready.channel,
          ready.appRef,
          reserve,
          ws.currency
        );
        cr.decisions.push({ portfolioAccountId: acc.id, decision, providerRef });
        if (decision === "dispatched") {
          cr.dispatched += 1;
          totalDispatched += 1;
          usage[ready.channel].dispatched += 1;
        } else {
          cr.skipped += 1;
        }
      }

      report.campaigns.push(cr);
    }

    report.channelUsage = usage;
    return report;
  }

  return { tick };
}
