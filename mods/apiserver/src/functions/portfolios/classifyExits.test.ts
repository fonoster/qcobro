import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createClassifyExits } from "./classifyExits.js";
import { matches } from "../recovery/fakeDb.js";

type Row = Record<string, unknown>;

const T1 = new Date("2026-10-28T15:00:00Z");
const CONTEXT = {
  hasGestion: true,
  touches: 2,
  activeCampaigns: [{ id: "c1", name: "Mora 8-30" }],
  lastTouch: {
    contactLogId: "l1",
    agentType: "VOICE_AI",
    delivery: "DELIVERED",
    path: "ENGAGED",
    outcome: "PAYMENT_PROMISE",
    contactedAt: "2026-10-26T15:00:00.000Z"
  },
  daysSinceLastTouch: 2
};

function unknownExit(externalId: string, fields: Row = {}): Row {
  return {
    id: `ex-${externalId}`,
    portfolioId: "p1",
    portfolioAccountId: `acc-${externalId}`,
    reason: "UNKNOWN",
    exitedAt: T1,
    previousSyncAt: new Date("2026-10-21T15:00:00Z"),
    missedInstallments: 3,
    termsAmount: 1500,
    context: CONTEXT,
    classifiedAt: null,
    reenteredAt: null,
    ...fields
  };
}

function makeDb(seed: { exits: Row[]; promises?: Row[] }) {
  const db = {
    accounts: ["A", "B", "C"].map((id) => ({ id: `acc-${id}`, portfolioId: "p1", externalId: id })),
    exits: seed.exits.map((e) => ({ ...e })),
    promises: (seed.promises ?? []).map((p) => ({ ...p })),
    recoveries: [] as Row[],
    locks: [] as unknown[],
    portfolioWrites: 0
  };
  const snapshot = () => JSON.stringify([db.exits, db.promises, db.recoveries]);
  const tx = {
    $queryRaw: async (_q: TemplateStringsArray, ...values: unknown[]) => {
      db.locks.push(values[0]);
      return [];
    },
    portfolio: {
      update: async () => {
        db.portfolioWrites++;
        return {};
      }
    },
    portfolioAccount: {
      findMany: async (args: { where: Row }) =>
        db.accounts.filter((a) => matches(a, args.where)).map((a) => ({ ...a }))
    },
    accountExit: {
      findMany: async (args: { where: Row }) =>
        db.exits
          .filter((e) => matches(e, args.where))
          .sort((a, b) => (b.exitedAt as Date).getTime() - (a.exitedAt as Date).getTime())
          .map((e) => ({ ...e })),
      updateMany: async (args: { where: Row; data: Row }) => {
        const hit = db.exits.filter((e) => matches(e, args.where));
        hit.forEach((e) => Object.assign(e, args.data));
        return { count: hit.length };
      }
    },
    recovery: {
      createMany: async (args: { data: Row[] }) => {
        db.recoveries.push(...args.data);
        return { count: args.data.length };
      }
    },
    paymentPromise: {
      updateMany: async (args: { where: Row; data: Row }) => {
        const hit = db.promises.filter((p) => matches(p, args.where));
        hit.forEach((p) => Object.assign(p, args.data));
        return { count: hit.length };
      }
    }
  };
  // Rolls the in-memory state back when the callback throws, like a real transaction.
  const client = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => {
      const before = snapshot();
      try {
        return await fn(tx);
      } catch (err) {
        const [exits, promises, recoveries] = JSON.parse(before, (k, v) =>
          typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && k !== "contactedAt"
            ? new Date(v)
            : v
        );
        db.exits = exits;
        db.promises = promises;
        db.recoveries = recoveries;
        throw err;
      }
    }
  };
  return { client, db };
}

const classify = (t: ReturnType<typeof makeDb>, exits: Row[]) =>
  createClassifyExits(t.client as never)({ portfolioId: "p1", exits });

describe("portfolios.classifyExits", () => {
  it("records a CURED recovery from the sent values on the exit's date and meets its promises", async () => {
    const t = makeDb({
      exits: [unknownExit("A")],
      promises: [
        { id: "P", portfolioAccountId: "acc-A", status: "EXPIRED", expiredByExitId: "ex-A" },
        { id: "Q", portfolioAccountId: "acc-A", status: "EXPIRED", expiredByExitId: "ex-earlier" }
      ]
    });
    const result = await classify(t, [
      { externalId: "A", reason: "CURED", missedInstallments: 2, termsAmount: 1500 }
    ]);
    assert.deepEqual(result, {
      classified: 1,
      recoveries: { cured: 1, paidOff: 0, amount: 3000 },
      promisesMet: 1
    });
    const rec = t.db.recoveries[0]!;
    assert.equal(rec.amount, 3000);
    assert.equal(rec.installments, 2);
    assert.equal((rec.detectedAt as Date).getTime(), T1.getTime());
    assert.deepEqual(rec.context, CONTEXT);
    assert.deepEqual(rec.campaignIds, ["c1"]);
    assert.equal(rec.lastTouchAgentType, "VOICE_AI");
    assert.equal(t.db.exits[0]!.reason, "CURED");
    assert.equal(t.db.exits[0]!.missedInstallments, 2);
    assert.ok(t.db.exits[0]!.classifiedAt instanceof Date);
    assert.equal(t.db.promises[0]!.status, "MET");
    assert.equal(t.db.promises[1]!.status, "EXPIRED", "an earlier episode's promise stays EXPIRED");
    assert.deepEqual(t.db.locks, ["p1"]);
    assert.equal(t.db.portfolioWrites, 0, "the portfolio row is not written");
  });

  it("records PAID_OFF the same way", async () => {
    const t = makeDb({ exits: [unknownExit("A")] });
    const result = await classify(t, [
      { externalId: "A", reason: "PAID_OFF", missedInstallments: 4, termsAmount: 1000 }
    ]);
    assert.deepEqual(result.recoveries, { cured: 0, paidOff: 1, amount: 4000 });
  });

  it("only sets the reason for WRITTEN_OFF, leaving promises EXPIRED", async () => {
    const t = makeDb({
      exits: [unknownExit("A")],
      promises: [
        { id: "P", portfolioAccountId: "acc-A", status: "EXPIRED", expiredByExitId: "ex-A" }
      ]
    });
    const result = await classify(t, [{ externalId: "A", reason: "WRITTEN_OFF" }]);
    assert.deepEqual(result, {
      classified: 1,
      recoveries: { cured: 0, paidOff: 0, amount: 0 },
      promisesMet: 0
    });
    assert.equal(t.db.recoveries.length, 0);
    assert.equal(t.db.exits[0]!.reason, "WRITTEN_OFF");
    assert.equal(t.db.exits[0]!.missedInstallments, 3);
    assert.equal(t.db.promises[0]!.status, "EXPIRED");
  });

  it("fails the whole batch, naming it, when one exit isn't pending classification", async () => {
    const t = makeDb({
      exits: [
        unknownExit("A"),
        unknownExit("B", { reason: "CURED", classifiedAt: new Date() }),
        unknownExit("C")
      ]
    });
    await assert.rejects(
      classify(t, [
        { externalId: "A", reason: "OTHER" },
        { externalId: "B", reason: "OTHER" },
        { externalId: "C", reason: "OTHER" }
      ]),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /externalId "B" has no exit pending classification/);
        return true;
      }
    );
    assert.deepEqual(
      t.db.exits.map((e) => e.reason),
      ["UNKNOWN", "CURED", "UNKNOWN"]
    );
  });

  it("names every account with no open UNKNOWN exit, including ones that never left or came back", async () => {
    const t = makeDb({ exits: [unknownExit("B", { reenteredAt: new Date() })] });
    await assert.rejects(
      classify(t, [
        { externalId: "A", reason: "OTHER" },
        { externalId: "B", reason: "OTHER" },
        { externalId: "ZZ", reason: "OTHER" }
      ]),
      /externalId "A" has no exit pending classification.*externalId "B".*externalId "ZZ"/s
    );
  });

  it("rejects CURED without termsAmount before touching anything", async () => {
    const t = makeDb({ exits: [unknownExit("A")] });
    await assert.rejects(
      classify(t, [{ externalId: "A", reason: "CURED", missedInstallments: 2 }]),
      ValidationError
    );
    assert.equal(t.db.exits[0]!.reason, "UNKNOWN");
    assert.deepEqual(t.db.locks, []);
  });
});
