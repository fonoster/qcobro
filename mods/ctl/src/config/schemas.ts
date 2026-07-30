import { z } from "zod";

/**
 * Local schema for a single logged-in workspace entry in `~/.qcobro/config.json`.
 * This describes the CLI's own local config file shape, not a cross-package API
 * contract, so it lives here rather than in `@qcobro/common` — mirroring the
 * precedent `mods/sdk/src/schemas.ts` sets for schemas that are local-only (see
 * that file's own doc comment).
 */
export const workspaceConfigSchema = z.object({
  /** Friendly local label; defaults to the workspace's accessKeyId. */
  name: z.string().min(1, "The name value is required"),
  /** QCobro API base URL this workspace was logged into. */
  endpoint: z.string().min(1, "The endpoint value is required"),
  /** The target workspace's accessKeyId (the `WO...` id acted in via `useWorkspace`). */
  workspaceAccessKeyId: z.string().min(1, "The workspaceAccessKeyId value is required"),
  /** Workspace API key id (`AP...`). */
  accessKeyId: z.string().min(1, "The accessKeyId value is required"),
  /** Workspace API key secret. */
  accessKeySecret: z.string().min(1, "The accessKeySecret value is required"),
  active: z.boolean().optional()
});

export type WorkspaceConfigInput = z.input<typeof workspaceConfigSchema>;
