import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { appRouter } from "../index.js";
import type { Context } from "../context.js";

// A recording stub of the Identity client — only the API-key methods the router
// touches, each tracking how often it was called and with what arguments.
function makeIdentity() {
  const calls: Record<string, unknown[][]> = {
    listApiKeys: [],
    createApiKey: [],
    regenerateApiKey: [],
    deleteApiKey: []
  };
  const identity = {
    listApiKeys: (...args: unknown[]) => {
      calls.listApiKeys.push(args);
      return Promise.resolve({
        items: [
          {
            ref: "k1",
            accessKeyId: "ak_1",
            role: "WORKSPACE_MEMBER",
            expiresAt: undefined,
            createdAt: 1,
            updatedAt: 1
          }
        ]
      });
    },
    createApiKey: (...args: unknown[]) => {
      calls.createApiKey.push(args);
      return Promise.resolve({ ref: "k2", accessKeyId: "ak_2", accessKeySecret: "sk_secret" });
    },
    regenerateApiKey: (...args: unknown[]) => {
      calls.regenerateApiKey.push(args);
      return Promise.resolve({ ref: "k1", accessKeyId: "ak_1", accessKeySecret: "sk_new" });
    },
    deleteApiKey: (...args: unknown[]) => {
      calls.deleteApiKey.push(args);
      return Promise.resolve({ ref: "k1" });
    }
  };
  return { identity, calls };
}

// Minimal context for an admin caller in workspace ak_ws. Only the fields the
// apiKeys procedures read are populated; the rest is irrelevant here.
function adminCtx(identity: unknown): Context {
  return {
    token: "tkn",
    user: { ref: "u1", accessKeyId: "us_1" },
    workspace: { accessKeyId: "ak_ws", role: "WORKSPACE_ADMIN" },
    identity
  } as unknown as Context;
}

function memberCtx(identity: unknown): Context {
  return {
    token: "tkn",
    user: { ref: "u1", accessKeyId: "us_1" },
    workspace: { accessKeyId: "ak_ws", role: "WORKSPACE_MEMBER" },
    identity
  } as unknown as Context;
}

describe("apiKeys router", () => {
  let identity: ReturnType<typeof makeIdentity>["identity"];
  let calls: ReturnType<typeof makeIdentity>["calls"];

  beforeEach(() => {
    const stub = makeIdentity();
    identity = stub.identity;
    calls = stub.calls;
  });

  it("list never returns a secret", async () => {
    const caller = appRouter.createCaller(adminCtx(identity));
    const res = await caller.apiKeys.list();
    assert.equal(res.items.length, 1);
    assert.equal("accessKeySecret" in res.items[0], false);
    assert.equal(calls.listApiKeys.length, 1);
    // Called with the active workspace accessKeyId + token.
    assert.deepEqual(calls.listApiKeys[0], ["ak_ws", "tkn"]);
  });

  it("create forwards role/expiry and returns the secret once", async () => {
    const caller = appRouter.createCaller(adminCtx(identity));
    const future = Date.now() + 86_400_000;
    const res = await caller.apiKeys.create({ role: "WORKSPACE_ADMIN", expiresAt: future });
    assert.equal(res.accessKeySecret, "sk_secret");
    assert.equal(calls.createApiKey.length, 1);
    assert.deepEqual(calls.createApiKey[0][0], { role: "WORKSPACE_ADMIN", expiresAt: future });
  });

  it("create with invalid input rejects WITHOUT calling Identity", async () => {
    const caller = appRouter.createCaller(adminCtx(identity));
    await assert.rejects(() =>
      // WORKSPACE_OWNER is not assignable to a key.
      caller.apiKeys.create({ role: "WORKSPACE_OWNER" as never })
    );
    assert.equal(calls.createApiKey.length, 0);
  });

  it("delete forwards the ref to Identity", async () => {
    const caller = appRouter.createCaller(adminCtx(identity));
    await caller.apiKeys.delete({ ref: "k1" });
    assert.equal(calls.deleteApiKey.length, 1);
    assert.deepEqual(calls.deleteApiKey[0], ["k1", "ak_ws", "tkn"]);
  });

  it("a non-admin member cannot manage keys", async () => {
    const caller = appRouter.createCaller(memberCtx(identity));
    await assert.rejects(() => caller.apiKeys.list(), /owner or admin/);
    assert.equal(calls.listApiKeys.length, 0);
  });
});
