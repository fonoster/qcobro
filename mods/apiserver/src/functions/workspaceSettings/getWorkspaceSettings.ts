import type { WorkspaceSettingsClient, WorkspaceSettingsRecord } from "@qcobro/common";

/**
 * Resolve the active workspace's settings, seeding a default row the first time a
 * workspace is used. The defaults (currency `USD`, timezone `America/Costa_Rica`) come
 * from the `WorkspaceSettings` column defaults, so a fresh workspace is always populated
 * without ever touching Identity.
 */
export function createGetWorkspaceSettings(client: WorkspaceSettingsClient) {
  return async (workspaceRef: string): Promise<WorkspaceSettingsRecord> => {
    const existing = await client.workspaceSettings.findUnique({ where: { workspaceRef } });
    if (existing) return existing;
    return client.workspaceSettings.upsert({
      where: { workspaceRef },
      create: { workspaceRef },
      update: {}
    });
  };
}
