import type { WorkspaceConfig } from "./types.js";

/** Removes the workspace with `workspaceAccessKeyId` from the configured list. */
export function removeWorkspace(
  workspaceAccessKeyId: string,
  workspaces: WorkspaceConfig[]
): WorkspaceConfig[] {
  return workspaces.filter((w) => w.workspaceAccessKeyId !== workspaceAccessKeyId);
}
