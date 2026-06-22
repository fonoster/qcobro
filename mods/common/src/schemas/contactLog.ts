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
  channelData: z.record(z.string(), z.unknown()).optional()
});
export type CreateContactLogInput = z.infer<typeof createContactLogSchema>;

export const updateObjectiveSchema = z.object({
  id: z.string().min(1),
  status: objectiveStatusSchema
});
export type UpdateObjectiveInput = z.infer<typeof updateObjectiveSchema>;
