import { z } from "zod";

/** Supported display/billing currencies. A workspace has exactly one. */
export const currencySchema = z.enum(["USD", "DOP"]);
export type Currency = z.infer<typeof currencySchema>;

/**
 * Locales this deployment formats numbers for. Deliberately a closed set, not "any BCP-47
 * tag": grouping and decimal separators differ per locale (`9,500` in es-DO, `9.500` in
 * es-ES), and an unverified tag would silently reformat every amount an agent reads aloud.
 * QCobro is launched in the Dominican Republic only, so the set has one member today; adding
 * a market means adding it here.
 */
export const supportedLocales = ["es-DO"] as const;
export const localeSchema = z.enum(supportedLocales);
export type Locale = z.infer<typeof localeSchema>;

/** The locale a workspace gets when none was chosen. Mirrors the Prisma column default. */
export const DEFAULT_LOCALE: Locale = "es-DO";

/**
 * Narrows a persisted locale to a supported one at the read boundary. The column is a plain
 * `String`, so a row written outside the app (a manual migration, a restored dump) could hold
 * a tag this deployment has never been checked against — that must not take down an inbound
 * webhook mid-conversation, so reads fall back to the default. Writes stay strict:
 * `workspaceSettingsSchema` rejects an unsupported tag outright.
 */
export function parseLocale(value: unknown): Locale {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LOCALE;
}

/** The per-workspace settings record (stored in the app DB, keyed by workspaceRef). */
export const workspaceSettingsSchema = z.object({
  workspaceRef: z.string().min(1),
  currency: currencySchema,
  timezone: z.string().min(1),
  locale: localeSchema
});
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

/**
 * Operator-editable settings for the active workspace. `locale` is deliberately absent: with
 * a single supported locale there is nothing to choose, so it stays application-managed
 * (persisted on the record, set from the column default). Adding a second market means adding
 * it here and building the picker.
 */
export const updateWorkspaceSettingsSchema = z.object({
  currency: currencySchema,
  timezone: z.string().min(1)
});
export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;
