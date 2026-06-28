import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGetWorkspaceSettings } from "./getWorkspaceSettings.js";

// The stub simulates the WorkspaceSettings column defaults (currency USD, timezone
// America/Costa_Rica) that fill any field the upsert `create` omits.
function makeClient(existing: Record<string, unknown> | null) {
  const cap: { upsert?: { where: unknown; create: Record<string, unknown> } } = {};
  const client = {
    workspaceSettings: {
      findUnique: async () => existing as never,
      upsert: async (args: { where: unknown; create: Record<string, unknown> }) => {
        cap.upsert = args;
        return {
          currency: "USD",
          timezone: "America/Costa_Rica",
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date()
        } as never;
      }
    }
  };
  return { client, cap };
}

describe("getWorkspaceSettings", () => {
  it("returns the existing settings without seeding", async () => {
    const row = {
      workspaceRef: "ws1",
      currency: "DOP",
      timezone: "America/Santo_Domingo",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const { client, cap } = makeClient(row);
    const settings = await createGetWorkspaceSettings(client as never)("ws1");
    assert.equal(settings.currency, "DOP");
    assert.equal(cap.upsert, undefined, "no seed when a row exists");
  });

  it("seeds a row keyed by workspaceRef (defaults come from the DB) when none exists", async () => {
    const { client, cap } = makeClient(null);
    const settings = await createGetWorkspaceSettings(client as never)("ws1");
    assert.equal(settings.currency, "USD");
    assert.equal(settings.timezone, "America/Costa_Rica");
    // The seed passes only the key; currency/timezone are filled by column defaults.
    assert.deepEqual(cap.upsert?.create, { workspaceRef: "ws1" });
  });
});
