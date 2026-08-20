import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contactLogEvents,
  CONTACT_LOG_CHANGED,
  contactLogEventsExtension
} from "./contactLogEvents.js";
import type { ContactLogChangeEvent } from "./contactLogEvents.js";

/** Waits for the next `contactLogChanged` event, or null if none arrives within `ms`. */
function nextEvent(ms = 200): Promise<ContactLogChangeEvent | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      contactLogEvents.off(CONTACT_LOG_CHANGED, onEvent);
      resolve(null);
    }, ms);
    function onEvent(event: ContactLogChangeEvent) {
      clearTimeout(timer);
      contactLogEvents.off(CONTACT_LOG_CHANGED, onEvent);
      resolve(event);
    }
    contactLogEvents.on(CONTACT_LOG_CHANGED, onEvent);
  });
}

function makeBase(overrides?: { account?: { portfolio: { workspaceRef: string } } | null }) {
  const calls: unknown[] = [];
  const base = {
    portfolioAccount: {
      findUnique: async (args: unknown) => {
        calls.push(args);
        return overrides?.account !== undefined
          ? overrides.account
          : { portfolio: { workspaceRef: "ws_1" } };
      }
    }
  };
  return { base, calls };
}

describe("contactLogEventsExtension", () => {
  it("emits a change signal after accountContactLog.create resolves", async () => {
    const { base } = makeBase();
    const ext = contactLogEventsExtension(base);
    const waiter = nextEvent();
    await ext.query.accountContactLog.$allOperations({
      operation: "create",
      args: {},
      query: async () => ({ id: "log-1", portfolioAccountId: "acc-1" })
    });
    assert.deepEqual(await waiter, { id: "log-1", workspaceRef: "ws_1" });
  });

  it("emits on update and upsert too", async () => {
    const { base } = makeBase();
    const ext = contactLogEventsExtension(base);
    for (const operation of ["update", "upsert"]) {
      const waiter = nextEvent();
      await ext.query.accountContactLog.$allOperations({
        operation,
        args: {},
        query: async () => ({ id: "log-1", portfolioAccountId: "acc-1" })
      });
      assert.deepEqual(await waiter, { id: "log-1", workspaceRef: "ws_1" });
    }
  });

  it("does not emit for a non-write operation (e.g. findMany)", async () => {
    const { base } = makeBase();
    const ext = contactLogEventsExtension(base);
    const waiter = nextEvent();
    await ext.query.accountContactLog.$allOperations({
      operation: "findMany",
      args: {},
      query: async () => [{ id: "log-1", portfolioAccountId: "acc-1" }]
    });
    assert.equal(await waiter, null);
  });

  it("still returns the query's result to the caller", async () => {
    const { base } = makeBase();
    const ext = contactLogEventsExtension(base);
    const result = await ext.query.accountContactLog.$allOperations({
      operation: "create",
      args: { data: { resultado: "DELIVERED" } },
      query: async (args) => ({
        id: "log-2",
        portfolioAccountId: "acc-1",
        ...(args as { data?: object }).data
      })
    });
    assert.deepEqual(result, { id: "log-2", portfolioAccountId: "acc-1", resultado: "DELIVERED" });
  });

  it("paymentPromise write emits a signal for its linked gestión id", async () => {
    const { base } = makeBase({ account: { portfolio: { workspaceRef: "ws_2" } } });
    const ext = contactLogEventsExtension(base);
    const waiter = nextEvent();
    await ext.query.paymentPromise.$allOperations({
      operation: "update",
      args: {},
      query: async () => ({ id: "promise-1", contactLogId: "log-9", portfolioAccountId: "acc-2" })
    });
    assert.deepEqual(await waiter, { id: "log-9", workspaceRef: "ws_2" });
  });

  it("a failed workspace lookup drops the signal instead of throwing", async () => {
    const base = {
      portfolioAccount: {
        findUnique: async () => {
          throw new Error("db unavailable");
        }
      }
    };
    const ext = contactLogEventsExtension(base);
    const waiter = nextEvent();
    // The write itself still succeeds and its result is returned — only the best-effort
    // signal is dropped.
    const result = await ext.query.accountContactLog.$allOperations({
      operation: "create",
      args: {},
      query: async () => ({ id: "log-1", portfolioAccountId: "acc-1" })
    });
    assert.deepEqual(result, { id: "log-1", portfolioAccountId: "acc-1" });
    assert.equal(await waiter, null);
  });

  it("drops the signal (no throw) when the account lookup finds nothing", async () => {
    const { base } = makeBase({ account: null });
    const ext = contactLogEventsExtension(base);
    const waiter = nextEvent();
    await ext.query.accountContactLog.$allOperations({
      operation: "create",
      args: {},
      query: async () => ({ id: "log-1", portfolioAccountId: "acc-missing" })
    });
    assert.equal(await waiter, null);
  });

  // Regression: the real write path runs `accountContactLog.create`/`.update` inside an
  // interactive `$transaction`. Resolving the workspace by re-reading the just-written
  // `accountContactLog` row (on a *separate* connection, as `base` is) would read before the
  // transaction commits and silently see nothing — dropping every signal. Resolving via the
  // row's own `portfolioAccountId` instead (a stable relation never modified by these writes)
  // sidesteps that: the lookup never depends on data the enclosing transaction just wrote.
  it("resolves via portfolioAccountId, not by re-reading the contact log itself", async () => {
    const { base, calls } = makeBase();
    const ext = contactLogEventsExtension(base);
    const waiter = nextEvent();
    await ext.query.accountContactLog.$allOperations({
      operation: "create",
      args: {},
      query: async () => ({ id: "log-1", portfolioAccountId: "acc-1" })
    });
    await waiter;
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: { id: "acc-1" },
      select: { portfolio: { select: { workspaceRef: true } } }
    });
  });
});
