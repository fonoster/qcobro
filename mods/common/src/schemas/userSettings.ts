import { z } from "zod";

/** Supported console languages. Keep in sync with the webapp message catalogs. */
export const languageSchema = z.enum(["en", "es"]);
export type Language = z.infer<typeof languageSchema>;

/** The per-user settings record (stored in the app DB, keyed by the Identity userRef). */
export const userSettingsSchema = z.object({
  userRef: z.string().min(1),
  language: languageSchema
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

/** Operator-editable user settings. */
export const updateUserLanguageSchema = z.object({
  language: languageSchema
});
export type UpdateUserLanguageInput = z.infer<typeof updateUserLanguageSchema>;
