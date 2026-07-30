import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appRouter } from "../index.js";
import type { Context } from "../context.js";
import { emitContactLogChanged } from "../../services/contactLogEvents.js";

/** A workspace-scoped caller. `ownedLogIds` are the gestión ids `findFirstOrThrow` accepts
 * as belonging to this workspace (mirrors the real ownership check `contactLog.get` and
 * `onChange` both perform). */
function callerFor(workspaceRef: string, ownedLogIds: Set<string>) {
  const ctx = {
    token: "tkn",
    user: { ref: "u1", accessKeyId: "us_1" },
    workspace: { accessKeyId: workspaceRef, role: "WORKSPACE_MEMBER" },
    prisma: {
      accountContactLog: {
        findFirstOrThrow: async (args: { where: { id: string } }) => {
          if (!ownedLogIds.has(args.where.id)) {
            throw new Error("No AccountContactLog found");
          }
          return { id: args.where.id };
        }
      }
    }
  } as unknown as Context;
  return appRouter.createCaller(ctx);
}

/** Collects the first `count` values from an async iterable, then stops it. */
async function take<T>(iterable: AsyncIterable<T>, count: number): Promise<T[]> {
  const out: T[] = [];
  for await (const value of iterable) {
    out.push(value);
    if (out.length >= count) break;
  }
  return out;
}

/** Lets the subscription's async generator run up to (and register) its event listener
 * before the test emits — the ownership check it may run first is itself async. */
function tick(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("campaigns.contactLog.onChange", () => {
  it("unfiltered subscription only yields events for the caller's workspace", async () => {
    const caller = callerFor("ws_1", new Set());
    const sub = await caller.campaigns.contactLog.onChange({});
    const results = take(sub, 1);
    await tick();
    emitContactLogChanged({ id: "log-other-ws", workspaceRef: "ws_2" });
    emitContactLogChanged({ id: "log-mine", workspaceRef: "ws_1" });
    assert.deepEqual(await results, [{ id: "log-mine" }]);
  });

  it("id-filtered subscription only yields changes to that gestión", async () => {
    const caller = callerFor("ws_1", new Set(["log-a"]));
    const sub = await caller.campaigns.contactLog.onChange({ id: "log-a" });
    const results = take(sub, 1);
    await tick();
    emitContactLogChanged({ id: "log-b", workspaceRef: "ws_1" });
    emitContactLogChanged({ id: "log-a", workspaceRef: "ws_1" });
    assert.deepEqual(await results, [{ id: "log-a" }]);
  });

  it("id-filtered subscription rejects a gestión outside the caller's workspace", async () => {
    const caller = callerFor("ws_1", new Set());
    // The resolver is an async generator: the ownership check inside only runs once the
    // subscription starts iterating, so the rejection surfaces on the first `.next()`, not
    // on the initial call.
    await assert.rejects(async () => {
      const sub = await caller.campaigns.contactLog.onChange({ id: "log-not-mine" });
      await sub[Symbol.asyncIterator]().next();
    });
  });

  it("subscribing without a workspace is rejected (workspaceProcedure)", async () => {
    const ctx = {
      token: "tkn",
      user: { ref: "u1", accessKeyId: "us_1" },
      workspace: null
    } as unknown as Context;
    const caller = appRouter.createCaller(ctx);
    await assert.rejects(() => caller.campaigns.contactLog.onChange({}));
  });
});
