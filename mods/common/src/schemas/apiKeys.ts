import { z } from "zod";

// API keys are workspace-scoped credentials for unattended, server-to-server
// integrations (e.g. @qcobro/sdk's loginWithApiKey). Unlike member invites,
// Fonoster Identity only permits WORKSPACE_ADMIN for an API key (its
// createApiKeyRequestSchema is `z.enum([WORKSPACE_ADMIN])`), so there is no role
// choice — every key is an admin-scoped key.
export const apiKeyRoleEnum = z.enum(["WORKSPACE_ADMIN"]);
export type ApiKeyRole = z.infer<typeof apiKeyRoleEnum>;

export const createApiKeySchema = z.object({
  role: apiKeyRoleEnum.default("WORKSPACE_ADMIN"),
  // Optional expiry as epoch milliseconds; must be in the future when present.
  // Identity stores no expiry when this is omitted (the key never expires).
  expiresAt: z
    .number()
    .int()
    .positive()
    .refine((ms) => ms > Date.now(), { message: "expiresAt must be in the future" })
    .optional()
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// Identifies a single key for regenerate/delete.
export const apiKeyRefSchema = z.object({
  ref: z.string().min(1)
});
export type ApiKeyRefInput = z.infer<typeof apiKeyRefSchema>;
