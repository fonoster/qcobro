import { withErrorHandlingAndValidation } from "@qcobro/common";
import { workspaceConfigSchema } from "./schemas.js";
import type { WorkspaceConfig } from "./types.js";

/**
 * Validated function: adds (or replaces) a workspace in the configured list.
 *
 * A factory that injects the current `workspaces` list and returns a function
 * that validates a candidate `WorkspaceConfig` against `workspaceConfigSchema`
 * before ever touching the list — invalid input (e.g. a missing
 * `accessKeySecret`) throws a structured `ValidationError` and the list is
 * returned unchanged (the caller never persists it). On valid input, every
 * other workspace is deactivated and the new (or updated) one is marked active,
 * matching `@fonoster/ctl`'s `addWorkspace` behavior.
 */
export function createAddWorkspace(workspaces: WorkspaceConfig[]) {
  const fn = async (config: WorkspaceConfig): Promise<WorkspaceConfig[]> => {
    const deactivateAll = (list: WorkspaceConfig[]) => list.map((w) => ({ ...w, active: false }));

    const index = workspaces.findIndex(
      (w) => w.workspaceAccessKeyId === config.workspaceAccessKeyId
    );

    if (index === -1) {
      return deactivateAll(workspaces).concat({ ...config, active: true });
    }

    const updated = deactivateAll(workspaces);
    updated[index] = { ...config, active: true };
    return updated;
  };

  return withErrorHandlingAndValidation(fn, workspaceConfigSchema);
}
