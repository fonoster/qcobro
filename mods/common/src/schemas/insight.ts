import { z } from "zod";
import { aiSentimentSchema } from "./contactLog.js";

/**
 * The structured analysis an LLM must return for a gestión transcript. Mirrors the
 * `ai*` fields on `AccountContactLog`, all of which are nullable columns.
 *
 * `aiSummary` is the one required field: every gestión that reaches the generator has a
 * non-empty transcript, the model can always summarize it, and downstream it doubles as
 * the "already analyzed" cache marker (`generateGestionInsight`). The other four are
 * `.nullable()` because a real conversation often does not yield them — no reason for the
 * debt is ever stated, the call never reaches a result, no next step is implied, and a
 * one-sided contact (voicemail, bounced thread) carries no sentiment. The model returns
 * `null` for those, matching the DB columns and every consumer (which already guard).
 * Text fields are written in the call's language; `aiSentiment`, when present, is one of
 * the fixed enum values.
 */
export const gestionInsightSchema = z.object({
  aiSummary: z.string().min(1),
  aiSentiment: aiSentimentSchema.nullable(),
  aiDebtReason: z.string().min(1).nullable(),
  aiResult: z.string().min(1).nullable(),
  aiNextStep: z.string().min(1).nullable()
});
export type GestionInsight = z.infer<typeof gestionInsightSchema>;

/** Input to the generate-insight operation — the gestión (contact-log) id. */
export const generateInsightInputSchema = z.object({ id: z.string().min(1) });
export type GenerateInsightInput = z.infer<typeof generateInsightInputSchema>;
