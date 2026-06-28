import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createUpdateUserLanguage } from "./updateUserLanguage.js";

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

describe("updateUserLanguage", () => {
  it("upserts the user's language", async () => {
    const { client, cap } = makeClient();
    await createUpdateUserLanguage(client as never, "u1")({ language: "en" });
    assert.equal(cap.upsert?.update.language, "en");
    assert.equal(cap.upsert?.create.userRef, "u1");
  });

  it("rejects an unsupported language with a ValidationError before any write", async () => {
    const { client, cap } = makeClient();
    await assert.rejects(
      () => createUpdateUserLanguage(client as never, "u1")({ language: "fr" as never }),
      ValidationError
    );
    assert.equal(cap.upsert, undefined, "no write on invalid input");
  });
});
