/**
 * Client interfaces the billing service functions depend on — the Prisma subset
 * they use, so tests inject stubs with no live database. Monetary columns are
 * BigInt in the database; these interfaces surface them as `bigint` and the
 * functions convert to safe-integer micro-unit `number`s at the boundary.
 */

/** Prisma's BillingMeter enum values (DB spelling of the common meter keys). */
export type DbBillingMeter =
  | "SMS"
  | "EMAIL"
  | "WHATSAPP_MESSAGE"
  | "VOICE_PRERECORDED"
  | "VOICE_AI"
  | "WHATSAPP_VOICE_PRERECORDED"
  | "WHATSAPP_VOICE_AI";

export type DbLedgerEntryKind = "GRANT" | "USAGE_DEBIT" | "VOID" | "ADJUSTMENT";

export interface WorkspaceBillingRecord {
  workspaceRef: string;
  billingAccountId: string;
  planKey: string;
  /** Enterprise overrides: a Partial of the shared rates schema (validated on read). */
  rateOverrides: unknown;
  stripeSubscriptionItemId: string | null;
  cycleStart: Date | null;
  cycleEnd: Date | null;
}

export interface UsageRecordRow {
  id: string;
  workspaceRef: string;
  meter: DbBillingMeter;
  quantity: number;
  unitPriceMicro: bigint;
  amountMicro: bigint;
  increments: string | null;
  settledAt: Date | null;
  campaignId: string | null;
  portfolioAccountId: string | null;
  providerRef: string | null;
  at: Date;
}

export interface LedgerEntryRow {
  id: string;
  workspaceRef: string;
  kind: DbLedgerEntryKind;
  amountMicro: bigint;
  at: Date;
  usageRecordId: string | null;
  stripeInvoiceId: string | null;
}

/** The Prisma subset the billing functions reach through the tRPC/engine context. */
export interface BillingClient {
  workspaceBilling: {
    findUnique(args: { where: { workspaceRef: string } }): Promise<WorkspaceBillingRecord | null>;
    update(args: {
      where: { workspaceRef: string };
      data: Record<string, unknown>;
    }): Promise<WorkspaceBillingRecord>;
  };

  billingAccount: {
    findUnique(args: {
      where: { id: string };
    }): Promise<{ id: string; paymentFailed: boolean; collectionMethod: string } | null>;
  };

  usageRecord: {
    create(args: { data: Record<string, unknown> }): Promise<UsageRecordRow>;
    findUnique(args: { where: { providerRef: string } }): Promise<UsageRecordRow | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<UsageRecordRow>;
  };

  ledgerEntry: {
    create(args: { data: Record<string, unknown> }): Promise<LedgerEntryRow>;
    aggregate(args: {
      where: { workspaceRef: string };
      _sum: { amountMicro: true };
    }): Promise<{ _sum: { amountMicro: bigint | null } }>;
  };

  $transaction<T>(fn: (tx: BillingClient) => Promise<T>): Promise<T>;
}
