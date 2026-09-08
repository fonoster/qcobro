import { z } from "zod";
import { agentTypeSchema } from "./agentTemplates.js";

/**
 * A gestión answers up to three independent questions, one per axis. They were previously
 * flattened into a single enum (then also confusingly called `outcome`, before the axis
 * split introduced `resultado` — since renamed to today's `outcome` below, a coincidence of
 * naming across two unrelated eras, not the same field), which is why no value meant one
 * thing: `WRONG_NUMBER` described both a carrier rejection (a delivery failure) and a human
 * saying "that's not me" (a delivery *success* carrying a valuable finding), and `OTHER`
 * served as dispatch placeholder, escalation marker, and unclassifiable-conversation
 * catch-all at once.
 */

/** Did the attempt reach the account holder's device or inbox? Never null. */
export const deliverySchema = z.enum(["DISPATCHED", "DELIVERED", "FAILED"]);
export type Delivery = z.infer<typeof deliverySchema>;

/**
 * Why delivery failed. Set if and only if `delivery` is `FAILED`. The values are chosen so a
 * retry policy can branch on them: `NO_ANSWER` and `BUSY` are transient, `INVALID_DESTINATION`
 * and `CHANNEL_UNSUPPORTED` are permanent for that contact point.
 *
 * `OUTCOME_UNKNOWN` and `NOT_ORIGINATED` are voice-only, both written by the voice
 * completion sweep from Fonoster's call detail record rather than a live completion
 * signal: `OUTCOME_UNKNOWN` when the call connected and cleared normally but QCobro's own
 * completion signal never arrived, `NOT_ORIGINATED` when the provider has no record of the
 * call at all. Both are transient — the account stays eligible for a retry.
 */
export const deliveryReasonSchema = z.enum([
  "NO_ANSWER",
  "BUSY",
  "UNREACHABLE",
  "PROVIDER_ERROR",
  "CHANNEL_UNSUPPORTED",
  "INVALID_DESTINATION",
  "REJECTED",
  "OUTCOME_UNKNOWN",
  "NOT_ORIGINATED"
]);
export type DeliveryReason = z.infer<typeof deliveryReasonSchema>;

/**
 * What path the interaction took once delivered. Null when no interaction was observed —
 * which is always the case on the one-way channels, and often the case elsewhere.
 * `VOICEMAIL` is reachable only on `VOICE_AI` and needs AMD before it can actually be
 * detected (issue #83); it is defined now so the enum needs no second migration later.
 */
export const pathSchema = z.enum(["ENGAGED", "ABANDONED", "VOICEMAIL"]);
export type Path = z.infer<typeof pathSchema>;

/**
 * What came of the engagement. Nullable and single-valued; null is the common case and means
 * nothing came of it, which is a real and frequent answer rather than missing data.
 */
export const outcomeSchema = z.enum([
  "PAYMENT_PROMISE",
  "NEW_TERMS",
  "PAID",
  "CALLBACK_REQUESTED",
  "DISPUTE_RAISED",
  "INFORMATION_REQUEST",
  "REFUSED",
  "OPT_OUT",
  "WRONG_PARTY",
  "RESOLVED"
]);
export type Outcome = z.infer<typeof outcomeSchema>;

/**
 * Channels with an inbound path, and therefore the only ones that can observe a `path` or
 * produce an `outcome`. `SMS` has no inbound ingestion at all, so both axes are not merely
 * usually-null there — they are unreachable. `VOICE_PRERECORDED` is the one exception: it has
 * no inbound path of its own, but reaching call completion (the script played to the end,
 * with or without an optional DTMF menu — see `prerecorded-audio`) always sets
 * `path: ENGAGED`, and the opt-out digit specifically also sets `outcome: OPT_OUT` — no
 * other path/outcome value is reachable. See {@link isAllowedOnPrerecorded} for that
 * narrow carve-out.
 */
export const CHANNEL_CAN_ENGAGE = ["VOICE_AI", "EMAIL", "WHATSAPP"] as const;

/** Whether a channel can observe an interaction beyond delivery. */
export function channelCanEngage(agentType: string): boolean {
  return (CHANNEL_CAN_ENGAGE as readonly string[]).includes(agentType);
}

const PRERECORDED_ALLOWED_PATH: ReadonlySet<Path> = new Set(["ENGAGED"]);
const PRERECORDED_ALLOWED_OUTCOME: ReadonlySet<Outcome> = new Set(["OPT_OUT"]);

/**
 * `VOICE_PRERECORDED`'s one carve-out from {@link channelCanEngage}: call completion sets
 * `path: ENGAGED`, and the opt-out digit specifically also sets `outcome: OPT_OUT` — and
 * nothing else. `ABANDONED`/`VOICEMAIL` and every other `outcome` value stay unreachable,
 * exactly as for any other one-way channel.
 */
function isAllowedOnPrerecorded(field: "path" | "outcome", value: Path | Outcome): boolean {
  return field === "path"
    ? PRERECORDED_ALLOWED_PATH.has(value as Path)
    : PRERECORDED_ALLOWED_OUTCOME.has(value as Outcome);
}

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

const createContactLogFields = z.object({
  portfolioAccountId: z.string().min(1),
  campaignId: z.string().min(1).optional(),
  /** Agent template used (campaign dispatch or ad-hoc follow-up). */
  agentTemplateId: z.string().min(1).optional(),
  /** Set when this gestión is an ad-hoc follow-up on a specific PaymentPromise. */
  paymentPromiseId: z.string().min(1).optional(),
  agentType: agentTypeSchema,
  contactedAt: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
  /** Defaults to the dispatch-time state, so a dispatch call site need not spell it out. */
  delivery: deliverySchema.default("DISPATCHED"),
  deliveryReason: deliveryReasonSchema.optional(),
  path: pathSchema.optional(),
  outcome: outcomeSchema.optional(),
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
  providerRef: z.string().min(1).optional(),
  /**
   * The provider's own message id, used to correlate *outbound* delivery events. Distinct
   * from `providerRef` and not a replacement for it: on EMAIL `providerRef` is the reply-to
   * token, which is the only thing an inbound reply carries, while Resend's delivery/open
   * events carry only the message id. Both keys are needed, so both are stored. Unset on the
   * channels whose callbacks correlate on `providerRef` alone.
   */
  providerMessageId: z.string().min(1).optional()
});

/**
 * The axes are independent, but two combinations are incoherent rather than merely unusual,
 * so they are rejected before the write rather than stored and worked around by every reader:
 *
 * - a failure reason without a failure (or a failure without a reason) — the reason is the
 *   only thing that makes `FAILED` actionable;
 * - an interaction recorded on a channel that cannot observe one.
 *
 * Note there is deliberately no rule tying `outcome` to `delivery`: a `FAILED` delivery can
 * still carry an `outcome` when someone answers and hangs up on a wrong-party identification.
 */
export const createContactLogSchema = createContactLogFields.superRefine((value, ctx) => {
  if (value.delivery === "FAILED" && !value.deliveryReason) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryReason"],
      message: "deliveryReason is required when delivery is FAILED"
    });
  }
  if (value.delivery !== "FAILED" && value.deliveryReason) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryReason"],
      message: `deliveryReason is only valid when delivery is FAILED (got ${value.delivery})`
    });
  }
  if (!channelCanEngage(value.agentType)) {
    for (const field of ["path", "outcome"] as const) {
      const fieldValue = value[field];
      if (!fieldValue) continue;
      if (value.agentType === "VOICE_PRERECORDED" && isAllowedOnPrerecorded(field, fieldValue)) {
        continue;
      }
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `${value.agentType} has no inbound path, so ${field} cannot be set${
          value.agentType === "VOICE_PRERECORDED" ? ` to ${fieldValue}` : ""
        }`
      });
    }
  }
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
