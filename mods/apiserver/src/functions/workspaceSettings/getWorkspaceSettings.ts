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
    try {
      return await client.workspaceSettings.upsert({
        where: { workspaceRef },
        create: { workspaceRef },
        update: {}
      });
    } catch (err) {
      // Prisma's upsert is not atomic: a concurrent caller (engine tick vs tRPC, or
      // two ticks in tests) can seed the row between our read and write and surface a
      // unique-constraint P2002. Only that race is recovered — the row exists now, so
      // re-read it. Anything else (dead connection, extension failure) propagates.
      if ((err as { code?: string }).code !== "P2002") throw err;
      const seeded = await client.workspaceSettings.findUnique({ where: { workspaceRef } });
      if (seeded) return seeded;
      throw err;
    }
  };
}
