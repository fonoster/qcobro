import { z } from "zod";

/** Supported console languages. Keep in sync with the webapp message catalogs. */
export const languageSchema = z.enum(["en", "es"]);
export type Language = z.infer<typeof languageSchema>;

/**
 * Console appearance preference. `system` follows the operating system's
 * `prefers-color-scheme`; `light` and `dark` pin a theme.
 */
export const themeSchema = z.enum(["system", "light", "dark"]);
export type Theme = z.infer<typeof themeSchema>;

/** The per-user settings record (stored in the app DB, keyed by the Identity userRef). */
export const userSettingsSchema = z.object({
  userRef: z.string().min(1),
  language: languageSchema,
  theme: themeSchema
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

/** Operator-editable user settings. */
export const updateUserLanguageSchema = z.object({
  language: languageSchema
});
export type UpdateUserLanguageInput = z.infer<typeof updateUserLanguageSchema>;

export const updateUserThemeSchema = z.object({
  theme: themeSchema
});
export type UpdateUserThemeInput = z.infer<typeof updateUserThemeSchema>;
