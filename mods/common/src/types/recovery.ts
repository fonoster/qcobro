import type { ExitReasonInput } from "../schemas/portfolios.js";

export type ExitReason = ExitReasonInput | "UNKNOWN";
export type RecoveryKind = "PARTIAL" | "CURED" | "PAID_OFF";

/**
 * What was happening with an account between two syncs: the gestiones with `contactedAt` in
 * `(previousSyncAt, detectedAt]`. Computed once, when the recovery or exit is recorded, and
 * never recomputed, so it survives later edits or deletion of the campaigns it names.
 */
export interface RecoveryContext {
  /** `touches > 0`. */
  hasGestion: boolean;
  touches: number;
  /** Distinct non-null campaigns among those gestiones, with the name at the time. */
  activeCampaigns: { id: string; name: string }[];
  lastTouch: {
    contactLogId: string;
    agentType: string;
    delivery: string;
    path: string | null;
    outcome: string | null;
    /** ISO 8601. */
    contactedAt: string;
  } | null;
  /** Whole days from `lastTouch.contactedAt` to the detecting sync. */
  daysSinceLastTouch: number | null;
}

export interface SyncResult {
  created: number;
  updated: number;
  /** Accounts archived by this call, from exits in any mode or UNKNOWN exits in REPLACE. */
  archived: number;
  total: number;
  /**
   * Exits this call created, by reason; `classified` counts UNKNOWN exits given a reason by
   * this call (not added to the per-reason counters); `skipped` counts no-op exit entries.
   */
  exitsByReason: Record<ExitReason, number> & { classified: number; skipped: number };
  /** Every Recovery this call created, including those from late classifications. */
  recoveries: { partial: number; cured: number; paidOff: number; amount: number };
}

/** The account fields the sync reads to detect recoveries and exits. */
export interface SyncAccountState {
  id: string;
  externalId: string;
  archivedAt: Date | null;
  missedInstallments: number;
  termsAmount: number;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

export interface AccountExitRecord {
  id: string;
  portfolioId: string;
  portfolioAccountId: string;
  reason: ExitReason;
  exitedAt: Date;
  previousSyncAt: Date;
  missedInstallments: number;
  termsAmount: number;
  context: RecoveryContext;
  classifiedAt: Date | null;
  reenteredAt: Date | null;
}

export interface RecoveryCreate {
  id: string;
  portfolioId: string;
  portfolioAccountId: string;
  exitId: string | null;
  kind: RecoveryKind;
  installments: number;
  amount: number;
  detectedAt: Date;
  previousSyncAt: Date;
  hasGestion: boolean;
  lastTouchAgentType: string | null;
  lastTouchOutcome: string | null;
  daysSinceLastTouch: number | null;
  campaignIds: string[];
  context: RecoveryContext;
}

/** One gestión as the snapshot reads it. */
export interface ContactLogTouch {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  campaign: { name: string } | null;
  agentType: string;
  delivery: string;
  path: string | null;
  outcome: string | null;
  contactedAt: Date;
}

type Where = Record<string, unknown>;

/**
 * The Prisma surface recovery tracking writes through, inside one interactive transaction.
 * Arguments are Prisma's own shapes; the sync and classify functions are the only callers.
 */
export interface RecoveryTx {
  /** Row lock on the portfolio: overlapping syncs of one portfolio run one after the other. */
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  accountExit: {
    findMany(args: { where: Where; orderBy?: Where }): Promise<AccountExitRecord[]>;
    createMany(args: { data: Omit<AccountExitRecord, "classifiedAt" | "reenteredAt">[] }): Promise<{
      count: number;
    }>;
    updateMany(args: { where: Where; data: Where }): Promise<{ count: number }>;
  };
  recovery: {
    createMany(args: { data: RecoveryCreate[] }): Promise<{ count: number }>;
  };
  accountContactLog: {
    findMany(args: { where: Where; select: Where }): Promise<ContactLogTouch[]>;
  };
  paymentPromise: {
    findMany(args: { where: Where; select: Where }): Promise<{ portfolioAccountId: string }[]>;
    updateMany(args: { where: Where; data: Where }): Promise<{ count: number }>;
  };
}

export interface RecoverySummary {
  /** Σ amount of recoveries with a gestión between syncs, detected in the period. */
  recovered: number;
  count: number;
  withoutGestion: number;
  withoutGestionCount: number;
  /** Open UNKNOWN exits now (not bound to the period), with the same portfolio filter. */
  pendingExits: number;
  currency: string;
}

export interface RecoveryBreakdownRow {
  key: string;
  /** Campaign name for CAMPAIGN rows; null otherwise. */
  name: string | null;
  amount: number;
  count: number;
}

export interface RecoveryBreakdown {
  /** False only for CAMPAIGN: a recovery counts in full for every campaign that touched it. */
  additive: boolean;
  rows: RecoveryBreakdownRow[];
}

export interface RecoveryListItem {
  id: string;
  portfolioId: string;
  portfolioAccountId: string;
  externalId: string;
  fullName: string;
  kind: RecoveryKind;
  installments: number;
  amount: number;
  detectedAt: Date;
  previousSyncAt: Date;
  context: RecoveryContext;
}

export interface ExitListItem {
  id: string;
  externalId: string;
  fullName: string;
  reason: ExitReason;
  exitedAt: Date;
  missedInstallments: number;
  termsAmount: number;
  /** Stored missedInstallments × termsAmount at exit: an estimate until the exit is classified. */
  amountIfRecovered: number;
  classifiedAt: Date | null;
}

export interface ClassifyExitsResult {
  classified: number;
  recoveries: { cured: number; paidOff: number; amount: number };
  promisesMet: number;
}

/** The Prisma surface the recovery read procedures query. */
export interface RecoveryReadClient {
  recovery: {
    findMany(args: {
      where: Where;
      select?: Where;
      include?: Where;
      orderBy?: Where;
      take?: number;
      skip?: number;
    }): Promise<Record<string, unknown>[]>;
    count(args: { where: Where }): Promise<number>;
  };
  accountExit: {
    findMany(args: {
      where: Where;
      include?: Where;
      orderBy?: Where;
      take?: number;
      skip?: number;
    }): Promise<Record<string, unknown>[]>;
    count(args: { where: Where }): Promise<number>;
  };
}
