import type { WorkspaceConfig } from "./types.js";

/** Returns the active workspace, or `undefined` if none is configured/active. */
export function getActiveWorkspace(workspaces: WorkspaceConfig[]): WorkspaceConfig | undefined {
  return workspaces.find((w) => w.active === true);
}
