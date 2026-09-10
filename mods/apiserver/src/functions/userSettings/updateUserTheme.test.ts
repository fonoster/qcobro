import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createUpdateUserTheme } from "./updateUserTheme.js";

function makeClient() {
  const cap: { upsert?: { create: Record<string, unknown>; update: Record<string, unknown> } } = {};
  const client = {
    userSettings: {
      findUnique: async () => null,
      upsert: async (args: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        cap.upsert = args;
        return {
          userRef: "u1",
          ...args.update,
          createdAt: new Date(),
          updatedAt: new Date()
        } as never;
      }
    }
  };
  return { client, cap };
}

describe("updateUserTheme", () => {
  it("upserts the user's theme", async () => {
    const { client, cap } = makeClient();
    await createUpdateUserTheme(client as never, "u1")({ theme: "dark" });
    assert.equal(cap.upsert?.update.theme, "dark");
    assert.equal(cap.upsert?.create.userRef, "u1");
    assert.equal(cap.upsert?.create.theme, "dark");
  });

  it("accepts the 'system' sentinel", async () => {
    const { client, cap } = makeClient();
    await createUpdateUserTheme(client as never, "u1")({ theme: "system" });
    assert.equal(cap.upsert?.update.theme, "system");
  });

  it("rejects an unsupported theme with a ValidationError before any write", async () => {
    const { client, cap } = makeClient();
    await assert.rejects(
      () => createUpdateUserTheme(client as never, "u1")({ theme: "sepia" as never }),
      ValidationError
    );
    assert.equal(cap.upsert, undefined, "no write on invalid input");
  });
});
