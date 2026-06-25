import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCreateContactLog } from "./createContactLog.js";

interface Captured {
  log?: Record<string, unknown>;
  accountUpdate?: Record<string, unknown>;
  objective?: Record<string, unknown>;
  stateCreate?: Record<string, unknown>;
  stateUpdate?: Record<string, unknown>;
}

const TZ = "UTC";

function makeClient() {
  const cap: Captured = {};
  const client = {
    accountContactLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        cap.log = args.data;
        return { id: "log-1", ...args.data } as never;
      },
      findFirst: async () => null,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) =>
        ({ id: args.where.id, ...args.data }) as never
    },
    portfolioAccount: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.accountUpdate = args.data;
        return { id: args.where.id } as never;
      }
    },
    objective: {
      create: async (args: { data: Record<string, unknown> }) => {
        cap.objective = args.data;
        return { id: "obj-1", ...args.data } as never;
      },
      findMany: async () => []
    },
    campaignTrigger: {
      findMany: async () => []
    },
    campaignAccountState: {
      findUnique: async () => null,
      upsert: async (args: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        cap.stateCreate = args.create;
        cap.stateUpdate = args.update;
        return {} as never;
      }
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
  };
  return { client, cap };
}

const BASE = {
  portfolioAccountId: "acc-1",
  campaignId: "camp-1",
  agentType: "VOICE_AI" as const,
  contactedAt: "2026-06-22T10:00:00.000Z"
};

describe("createContactLog (reserve + record)", () => {
  it("always updates lastContactedAt and increments totalAttempts", async () => {
    const { client, cap } = makeClient();
    const fn = createCreateContactLog(client as never, TZ);

    await fn({ ...BASE, outcome: "NO_ANSWER" });

    assert.equal(cap.accountUpdate?.lastContactedAt instanceof Date, true);
    assert.deepEqual(cap.accountUpdate?.totalAttempts, { increment: 1 });
    // No hard outcome → the only account update is the reserve's hot-path bump.
    assert.equal("intentStatus" in (cap.accountUpdate ?? {}), false);
    assert.equal("suppressUntil" in (cap.accountUpdate ?? {}), false);
  });

  it("sets campaign-local suppressUntil on PAYMENT_PROMISE and leaves global suppression untouched", async () => {
    const { client, cap } = makeClient();
    const fn = createCreateContactLog(client as never, TZ);

    await fn({
      ...BASE,
      outcome: "PAYMENT_PROMISE",
      intentMetadata: { promisedAmount: 500, promisedDate: "2026-07-01T00:00:00.000Z" }
    });

    // Campaign-local suppression (record's upsert) carries the promise date.
    const suppress = cap.stateCreate?.suppressUntil as Date;
    assert.equal(suppress instanceof Date, true);
    assert.equal(suppress.toISOString(), "2026-07-01T00:00:00.000Z");
    // Global account suppression is NOT set by a payment promise.
    assert.equal("suppressUntil" in (cap.accountUpdate ?? {}), false);
    // Objective created with the promised amount.
    assert.equal(cap.objective?.type, "PAYMENT_PROMISE");
    assert.equal(cap.objective?.amount, 500);
  });

  it("counts the attempt once at reserve (attemptCount increments, attemptsToday reset-aware)", async () => {
    const { client, cap } = makeClient();
    const fn = createCreateContactLog(client as never, TZ);

    await fn({ ...BASE, outcome: "NO_ANSWER" });

    assert.deepEqual(cap.stateUpdate?.attemptCount, { increment: 1 });
    // No prior state → today's count resets to 1 (a computed value, not an increment).
    assert.equal(cap.stateUpdate?.attemptsToday, 1);
    assert.equal(cap.stateCreate?.attemptCount, 1);
    assert.equal(cap.stateCreate?.attemptsToday, 1);
  });

  it("sets global intentStatus = INTENT_MET on RESOLVED and PAID", async () => {
    for (const outcome of ["RESOLVED", "PAID"] as const) {
      const { client, cap } = makeClient();
      const fn = createCreateContactLog(client as never, TZ);
      await fn({ ...BASE, outcome });
      assert.equal(cap.accountUpdate?.intentStatus, "INTENT_MET");
    }
  });

  it("maps WRONG_NUMBER and OPT_OUT to matching intentStatus", async () => {
    for (const outcome of ["WRONG_NUMBER", "OPT_OUT"] as const) {
      const { client, cap } = makeClient();
      const fn = createCreateContactLog(client as never, TZ);
      await fn({ ...BASE, outcome });
      assert.equal(cap.accountUpdate?.intentStatus, outcome);
    }
  });
});
