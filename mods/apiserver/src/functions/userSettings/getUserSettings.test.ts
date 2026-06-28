import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGetUserSettings } from "./getUserSettings.js";

// The stub simulates the UserSettings column default (language "es") filling any field the
// upsert `create` omits.
function makeClient(existing: Record<string, unknown> | null) {
  const cap: { upsert?: { where: unknown; create: Record<string, unknown> } } = {};
  const client = {
    userSettings: {
      findUnique: async () => existing as never,
      upsert: async (args: { where: unknown; create: Record<string, unknown> }) => {
        cap.upsert = args;
        return {
          language: "es",
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date()
        } as never;
      }
    }
  };
  return { client, cap };
}

describe("getUserSettings", () => {
  it("returns the existing settings without seeding", async () => {
    const row = { userRef: "u1", language: "en", createdAt: new Date(), updatedAt: new Date() };
    const { client, cap } = makeClient(row);
    const settings = await createGetUserSettings(client as never)("u1");
    assert.equal(settings.language, "en");
    assert.equal(cap.upsert, undefined, "no seed when a row exists");
  });

  it("seeds a row keyed by userRef (language default from the DB) when none exists", async () => {
    const { client, cap } = makeClient(null);
    const settings = await createGetUserSettings(client as never)("u1");
    assert.equal(settings.language, "es");
    assert.deepEqual(cap.upsert?.create, { userRef: "u1" });
  });
});
