import { z } from "zod";
import { agentTypeSchema } from "./agentTemplates.js";

export const contactOutcomeSchema = z.enum([
  "NO_ANSWER",
  "PAYMENT_PROMISE",
  "PARTIAL_PAYMENT_AGREED",
  "CALLBACK_REQUESTED",
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

export const objectiveTypeSchema = z.enum([
  "PAYMENT_PROMISE",
  "PARTIAL_PAYMENT",
  "CALLBACK_SCHEDULED",
  "INFORMATION_REQUEST",
  "DISPUTE_RAISED",
  "OTHER"
]);
export type ObjectiveType = z.infer<typeof objectiveTypeSchema>;

export const objectiveStatusSchema = z.enum(["PENDING", "MET", "BROKEN", "CANCELLED"]);
export type ObjectiveStatus = z.infer<typeof objectiveStatusSchema>;

export const createContactLogSchema = z.object({
  portfolioAccountId: z.string().min(1),
  campaignId: z.string().min(1).optional(),
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

export const updateObjectiveSchema = z.object({
  id: z.string().min(1),
  status: objectiveStatusSchema
});
export type UpdateObjectiveInput = z.infer<typeof updateObjectiveSchema>;
