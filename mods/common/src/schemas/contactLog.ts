import { z } from "zod";
import { agentTypeSchema } from "./agentTemplates.js";

export const contactOutcomeSchema = z.enum([
  "DISPATCHED",
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
  "REFUSED"
]);
export type ContactOutcome = z.infer<typeof contactOutcomeSchema>;

/**
 * Outcomes that mean the channel did NOT prove it reached the destination:
 * `DISPATCHED` (no result yet), plus the three terminal failure/pending results. An
 * account counts as contacted when it has at least one gestión whose outcome is
 * *not* in this set — see the `portfolios` contactability statistic. Exported as one
 * definition (with {@link CONTACT_OUTCOME_RANK}) so the KPI query and the
 * no-downgrade rule in `recordOutcomeTx` never re-derive it independently.
 */
export const CHANNEL_FAILED_OUTCOMES = [
  "DISPATCHED",
  "NOT_DELIVERED",
  "NO_ANSWER",
  "WRONG_NUMBER"
] as const satisfies readonly ContactOutcome[];

/**
 * How much a layer knows, from least (0) to most (2). An outcome SHALL only move up:
 * rank 0 is dispatch's own placeholder; rank 1 is what the channel layer (provider
 * callback/CDR/inbound reply) can determine on its own; rank 2 is anything the
 * conversation layer (autopilot) adds on top. `recordOutcomeTx` keeps the existing
 * outcome when an incoming one ranks strictly lower — see design.md Decision 2.
 */
export const CONTACT_OUTCOME_RANK: Record<ContactOutcome, 0 | 1 | 2> = {
  DISPATCHED: 0,
  DELIVERED: 1,
  NOT_DELIVERED: 1,
  NO_ANSWER: 1,
  WRONG_NUMBER: 1,
  PAYMENT_PROMISE: 2,
  PARTIAL_PAYMENT_AGREED: 2,
  NEW_TERMS: 2,
  CALLBACK_REQUESTED: 2,
  DISPUTE_RAISED: 2,
  INFORMATION_REQUEST: 2,
  RESOLVED: 2,
  PAID: 2,
  OPT_OUT: 2,
  REFUSED: 2
};

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
