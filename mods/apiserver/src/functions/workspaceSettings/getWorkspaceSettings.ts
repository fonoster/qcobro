import type { WorkspaceSettingsClient, WorkspaceSettingsRecord } from "@qcobro/common";

/**
 * Resolve the active workspace's settings, seeding a default row (currency `USD`,
 * timezone = the deployment default) the first time a workspace is used. This keeps
 * `ctx.timezone`/`ctx.currency` populated for every workspace without ever touching
 * Identity, and makes the `qcobro.json` timezone meaningful only as the seed default.
 */
export function createGetWorkspaceSettings(
  client: WorkspaceSettingsClient,
  defaultTimezone: string
) {
  return async (workspaceRef: string): Promise<WorkspaceSettingsRecord> => {
    const existing = await client.workspaceSettings.findUnique({ where: { workspaceRef } });
    if (existing) return existing;
    return client.workspaceSettings.upsert({
      where: { workspaceRef },
      create: { workspaceRef, currency: "USD", timezone: defaultTimezone },
      update: {}
    });
  };
}
