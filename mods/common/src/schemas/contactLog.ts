import { z } from "zod";
import { agentTypeSchema } from "./agentTemplates.js";

export const contactOutcomeSchema = z.enum([
  "DELIVERED",
  "NOT_DELIVERED",
  "NO_ANSWER",
  "PAYMENT_PROMISE",
  "PARTIAL_PAYMENT_AGREED",
  "NEW_TERMS",
  "CALLBACK_REQUESTED",
  "DISPUTE_RAISED",
  "INFORMATION_REQUEST",
  "RESOLVED",
  "PAID",
  "WRONG_NUMBER",
  "OPT_OUT",
  "REFUSED",
  "OTHER"
]);
export type ContactOutcome = z.infer<typeof contactOutcomeSchema>;

export const aiSentimentSchema = z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "HOSTILE"]);
export type AiSentiment = z.infer<typeof aiSentimentSchema>;

/**
 * PaymentPromise is the only outcome QCobro tracks with a lifecycle, because a payment
 * is the only commitment it can verify. DUE is derived (PENDING past its dueDate), not a
 * stored status. There is intentionally no "broken" status — an unpaid promise stays on
 * the worklist until an operator resolves it. EXPIRED is set when the account leaves its
 * portfolio.
 */
export const paymentPromiseStatusSchema = z.enum(["PENDING", "MET", "EXPIRED", "CANCELLED"]);
export type PaymentPromiseStatus = z.infer<typeof paymentPromiseStatusSchema>;

export const createContactLogSchema = z.object({
  portfolioAccountId: z.string().min(1),
  campaignId: z.string().min(1).optional(),
  /** Agent template used (campaign dispatch or ad-hoc follow-up). */
  agentTemplateId: z.string().min(1).optional(),
  /** Set when this gestión is an ad-hoc follow-up on a specific PaymentPromise. */
  paymentPromiseId: z.string().min(1).optional(),
  agentType: agentTypeSchema,
  contactedAt: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
  outcome: contactOutcomeSchema,
  notes: z.string().optional(),
  debtAmountSnapshot: z.number().nonnegative().optional(),
  aiSummary: z.string().optional(),
  aiSentiment: aiSentimentSchema.optional(),
  aiDebtReason: z.string().optional(),
  aiResult: z.string().optional(),
  aiNextStep: z.string().optional(),
  intentMetadata: z.record(z.string(), z.unknown()).optional(),
  channelData: z.record(z.string(), z.unknown()).optional(),
  /**
   * Provider call ref (voice) / message sid (sms) for the dispatch-time attempt.
   * When present, `recordOutcome` upserts the gestión keyed by it (one row per
   * attempt, enriched by the async callback) instead of inserting a duplicate.
   */
  providerRef: z.string().min(1).optional()
});
export type CreateContactLogInput = z.infer<typeof createContactLogSchema>;

/**
 * Input to reserve a campaign attempt before the provider call (the engine's
 * at-most-once step). Increments the attempt counters; writes no gestión.
 */
export const reserveAttemptSchema = z.object({
  campaignId: z.string().min(1).optional(),
  portfolioAccountId: z.string().min(1),
  /** When the attempt is being made (ISO). */
  at: z.string().min(1)
});
export type ReserveAttemptInput = z.infer<typeof reserveAttemptSchema>;

/**
 * Operator resolution of a payment promise. A promise leaves PENDING only by explicit
 * action: `MET` (paid — v1 is manual-only, no trusted payment signal) or `CANCELLED`.
 * `EXPIRED` is set by the system when the account leaves its portfolio, not here.
 */
export const updatePaymentPromiseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["MET", "CANCELLED"])
});
export type UpdatePaymentPromiseInput = z.infer<typeof updatePaymentPromiseSchema>;

/**
 * Follow up on a payment promise with an ad-hoc agent dispatch (no campaign). Writes a
 * gestión with `campaignId` null, the chosen `agentTemplateId`, and a link to the promise.
 */
export const followUpPaymentPromiseSchema = z.object({
  paymentPromiseId: z.string().min(1),
  agentTemplateId: z.string().min(1)
});
export type FollowUpPaymentPromiseInput = z.infer<typeof followUpPaymentPromiseSchema>;
