import { z } from "zod";
import { sumMicroUnits } from "./money.js";
import { billingMeterSchema } from "./rates.js";

/**
 * Usage-ledger contracts: the durable, priced-at-write-time record of every
 * billable event and the signed entries a workspace balance derives from.
 *
 * These are deliberately separate from the engine flight recorder
 * (`engineEvents`), which is lossy, pruned telemetry. Usage records are written
 * in the same transaction as the dispatch's contact log and are never pruned.
 */

/**
 * Signed ledger entry kinds. Sign conventions: GRANT positive (allowance
 * opens a cycle), USAGE_DEBIT negative (a priced dispatch), VOID negative
 * (unused remainder at cycle close — no rollover), ADJUSTMENT either sign
 * (voice settlement replacing the dispatch-time estimate).
 */
export const ledgerEntryKindSchema = z.enum(["GRANT", "USAGE_DEBIT", "VOID", "ADJUSTMENT"]);
export type LedgerEntryKind = z.infer<typeof ledgerEntryKindSchema>;

export const ledgerEntrySchema = z.object({
  id: z.string().min(1),
  workspaceRef: z.string().min(1),
  kind: ledgerEntryKindSchema,
  /** Signed integer micro-units (see kind sign conventions). */
  amountMicro: z.number().int(),
  /** Entry instant, ISO. */
  at: z.string().min(1),
  /** The usage record this debit/adjustment prices, when applicable. */
  usageRecordId: z.string().min(1).optional(),
  /** Cycle-turnover idempotency key: set on GRANT and VOID entries. */
  stripeInvoiceId: z.string().min(1).optional()
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/**
 * One priced billable event. Quantity semantics per meter kind: message meters
 * store quantity = messages (1) and unitPriceMicro per message; voice meters
 * store quantity = increment-billed seconds and unitPriceMicro per minute, with
 * amountMicro = quantity × unitPriceMicro / 60 rounded to the micro-unit.
 */
export const usageRecordSchema = z.object({
  id: z.string().min(1),
  workspaceRef: z.string().min(1),
  meter: billingMeterSchema,
  quantity: z.number().int().nonnegative(),
  unitPriceMicro: z.number().int().nonnegative(),
  amountMicro: z.number().int().nonnegative(),
  /** Correlation spine (mirrors the contact log / engine events). */
  campaignId: z.string().min(1).optional(),
  portfolioAccountId: z.string().min(1).optional(),
  /** Provider ref of the dispatch; the settlement idempotency key for voice. */
  providerRef: z.string().min(1).optional(),
  at: z.string().min(1)
});
export type UsageRecord = z.infer<typeof usageRecordSchema>;

/**
 * Derives a workspace balance from its ledger entries. The ledger is the source
 * of truth — any cached balance is an optimization that must equal this sum.
 */
export function deriveBalanceMicro(entries: Iterable<Pick<LedgerEntry, "amountMicro">>): number {
  return sumMicroUnits(Array.from(entries, (entry) => entry.amountMicro));
}
