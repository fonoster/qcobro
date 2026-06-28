import { z } from "zod";

/** Supported display/billing currencies. A workspace has exactly one. */
export const currencySchema = z.enum(["USD", "DOP"]);
export type Currency = z.infer<typeof currencySchema>;

/** The per-workspace settings record (stored in the app DB, keyed by workspaceRef). */
export const workspaceSettingsSchema = z.object({
  workspaceRef: z.string().min(1),
  currency: currencySchema,
  timezone: z.string().min(1)
});
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

/** Operator-editable settings for the active workspace. */
export const updateWorkspaceSettingsSchema = z.object({
  currency: currencySchema,
  timezone: z.string().min(1)
});
export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;
