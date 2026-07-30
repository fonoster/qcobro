import type { WorkspaceConfig } from "./types.js";

/** Marks the workspace with `workspaceAccessKeyId` active, and every other one inactive. */
export function setActiveWorkspace(
  workspaceAccessKeyId: string,
  workspaces: WorkspaceConfig[]
): WorkspaceConfig[] {
  return workspaces.map((w) => ({
    ...w,
    active: w.workspaceAccessKeyId === workspaceAccessKeyId
  }));
}
