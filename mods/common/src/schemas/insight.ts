import { z } from "zod";
import { aiSentimentSchema } from "./contactLog.js";

/**
 * The structured analysis an LLM must return for a gestión transcript. Mirrors the
 * `ai*` fields on `AccountContactLog`; text fields are written in the call's language,
 * `aiSentiment` is always one of the fixed enum values.
 */
export const gestionInsightSchema = z.object({
  aiSummary: z.string().min(1),
  aiSentiment: aiSentimentSchema,
  aiDebtReason: z.string().min(1),
  aiResult: z.string().min(1),
  aiNextStep: z.string().min(1)
});
export type GestionInsight = z.infer<typeof gestionInsightSchema>;

/** Input to the generate-insight operation — the gestión (contact-log) id. */
export const generateInsightInputSchema = z.object({ id: z.string().min(1) });
export type GenerateInsightInput = z.infer<typeof generateInsightInputSchema>;
