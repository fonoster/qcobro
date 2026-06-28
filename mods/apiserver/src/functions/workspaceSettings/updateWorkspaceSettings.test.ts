import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createUpdateWorkspaceSettings } from "./updateWorkspaceSettings.js";

function makeClient() {
  const cap: { upsert?: { create: Record<string, unknown>; update: Record<string, unknown> } } = {};
  const client = {
    workspaceSettings: {
      findUnique: async () => null,
      upsert: async (args: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        cap.upsert = args;
        return {
          workspaceRef: "ws1",
          ...args.update,
          createdAt: new Date(),
          updatedAt: new Date()
        } as never;
      }
    }
  };
  return { client, cap };
}

describe("updateWorkspaceSettings", () => {
  it("upserts the workspace currency and timezone", async () => {
    const { client, cap } = makeClient();
    await createUpdateWorkspaceSettings(
      client as never,
      "ws1"
    )({
      currency: "DOP",
      timezone: "America/Santo_Domingo"
    });
    assert.equal(cap.upsert?.update.currency, "DOP");
    assert.equal(cap.upsert?.update.timezone, "America/Santo_Domingo");
    assert.equal(cap.upsert?.create.workspaceRef, "ws1");
  });

  it("rejects an unsupported currency with a ValidationError before any write", async () => {
    const { client, cap } = makeClient();
    await assert.rejects(
      () =>
        createUpdateWorkspaceSettings(
          client as never,
          "ws1"
        )({
          currency: "EUR" as never,
          timezone: "America/Santo_Domingo"
        }),
      ValidationError
    );
    assert.equal(cap.upsert, undefined, "no write on invalid input");
  });

  it("rejects an empty timezone with a ValidationError", async () => {
    const { client, cap } = makeClient();
    await assert.rejects(
      () =>
        createUpdateWorkspaceSettings(client as never, "ws1")({ currency: "USD", timezone: "" }),
      ValidationError
    );
    assert.equal(cap.upsert, undefined, "no write on invalid input");
  });
});
