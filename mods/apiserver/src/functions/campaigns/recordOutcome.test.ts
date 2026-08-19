import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecordOutcome } from "./recordOutcome.js";

interface Cap {
  created?: Record<string, unknown>;
  updated?: { id: string; data: Record<string, unknown> };
  promiseCreated?: Record<string, unknown>;
}

function makeClient(opts: {
  existing?: Record<string, unknown> | null;
  existingPromise?: Record<string, unknown> | null;
}) {
  const cap: Cap = {};
  const client = {
    accountContactLog: {
      findFirst: async () => (opts.existing ?? null) as never,
      create: async (args: { data: Record<string, unknown> }) => {
        cap.created = args.data;
        return { id: "new-log", ...args.data } as never;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.updated = { id: args.where.id, data: args.data };
        return { id: args.where.id, ...args.data } as never;
      }
    },
    portfolioAccount: {
      update: async (args: { where: { id: string } }) => ({ id: args.where.id }) as never
    },
    paymentPromise: {
      findFirst: async () => (opts.existingPromise ?? null) as never,
      create: async (args: { data: Record<string, unknown> }) => {
        cap.promiseCreated = args.data;
        return { id: "promise", ...args.data } as never;
      }
    },
    campaignTrigger: { findMany: async () => [] as never },
    campaignAccountState: {
      upsert: async () => ({}) as never
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

describe("recordOutcome", () => {
  it("creates a new gestión when there is no providerRef", async () => {
    const { client, cap } = makeClient({ existing: null });
    await createRecordOutcome(client as never)({ ...BASE, outcome: "NO_ANSWER" });
    assert.ok(cap.created, "should create");
    assert.equal(cap.updated, undefined, "should not update");
  });

  it("enriches the existing gestión by providerRef instead of duplicating", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        outcome: "DISPATCHED",
        providerRef: "ref-1",
        channelData: { from: "x" }
      }
    });
    await createRecordOutcome(client as never)({
      ...BASE,
      outcome: "PAYMENT_PROMISE",
      providerRef: "ref-1",
      intentMetadata: { promisedAmount: 500, promisedDate: "2026-07-01T00:00:00.000Z" }
    });
    assert.equal(cap.created, undefined, "should not create a duplicate");
    assert.equal(cap.updated?.id, "log-1");
    assert.equal(cap.updated?.data.outcome, "PAYMENT_PROMISE");
    // Merges channel data from the dispatch-time row.
    assert.deepEqual(cap.updated?.data.channelData, { from: "x" });
    // PaymentPromise created for the payment outcome with amount + dueDate.
    assert.equal(cap.promiseCreated?.amount, 500);
    assert.equal(cap.promiseCreated?.status, "PENDING");
    assert.ok(cap.promiseCreated?.dueDate, "carries a due date");
  });

  it("falls back to contactedAt when the promised date is vague (Invalid Date)", async () => {
    // The LLM autopilot extracts free text like "mañana" that `new Date()` can't parse.
    const { client, cap } = makeClient({ existing: null });
    await createRecordOutcome(client as never)({
      ...BASE,
      outcome: "PAYMENT_PROMISE",
      intentMetadata: { promisedAmount: 9500, promisedDate: "mañana" }
    });
    const dueDate = cap.promiseCreated?.dueDate as Date;
    assert.ok(dueDate instanceof Date && !Number.isNaN(dueDate.getTime()), "due date is valid");
    assert.equal(dueDate.toISOString(), BASE.contactedAt, "falls back to contactedAt");
  });

  it("creates no PaymentPromise for a non-payment outcome", async () => {
    const { client, cap } = makeClient({ existing: null });
    await createRecordOutcome(client as never)({ ...BASE, outcome: "NEW_TERMS" });
    assert.equal(cap.promiseCreated, undefined, "non-payment outcome creates no promise");
  });

  it("never downgrades a real outcome with a dispatch-time DISPATCHED", async () => {
    const { client, cap } = makeClient({
      existing: { id: "log-1", outcome: "PAYMENT_PROMISE", providerRef: "ref-1", channelData: {} }
    });
    await createRecordOutcome(client as never)({
      ...BASE,
      outcome: "DISPATCHED",
      providerRef: "ref-1"
    });
    assert.equal(cap.updated?.data.outcome, "PAYMENT_PROMISE", "kept the real outcome");
  });

  // Decision 2 truth table (design.md) — every row, via the rank comparison in recordOutcomeTx.
  describe("no-downgrade rank rule (design.md Decision 2)", () => {
    const cases: { existing: string; incoming: string; expected: string; why: string }[] = [
      {
        existing: "DISPATCHED",
        incoming: "DELIVERED",
        expected: "DELIVERED",
        why: "channel finalizes the placeholder"
      },
      {
        existing: "DISPATCHED",
        incoming: "PAYMENT_PROMISE",
        expected: "PAYMENT_PROMISE",
        why: "conversation resolved before the CDR"
      },
      {
        existing: "DELIVERED",
        incoming: "PAYMENT_PROMISE",
        expected: "PAYMENT_PROMISE",
        why: "conversation upgrades the channel"
      },
      {
        existing: "PAYMENT_PROMISE",
        incoming: "DELIVERED",
        expected: "PAYMENT_PROMISE",
        why: "no downgrade — the spec'd guarantee (today's OTHER-only guard would fail this)"
      },
      {
        existing: "PAYMENT_PROMISE",
        incoming: "DISPATCHED",
        expected: "PAYMENT_PROMISE",
        why: "no downgrade"
      },
      {
        existing: "PAYMENT_PROMISE",
        incoming: "DISPUTE_RAISED",
        expected: "DISPUTE_RAISED",
        why: "equal rank — the thread moved on"
      }
    ];

    for (const { existing, incoming, expected, why } of cases) {
      it(`existing=${existing}, incoming=${incoming} → ${expected} (${why})`, async () => {
        const { client, cap } = makeClient({
          existing: { id: "log-1", outcome: existing, providerRef: "ref-1", channelData: {} }
        });
        await createRecordOutcome(client as never)({
          ...BASE,
          outcome: incoming as never,
          providerRef: "ref-1"
        });
        assert.equal(cap.updated?.data.outcome, expected);
      });
    }
  });

  it("does not duplicate a PaymentPromise on re-delivery", async () => {
    const { client, cap } = makeClient({
      existing: { id: "log-1", outcome: "PAYMENT_PROMISE", providerRef: "ref-1", channelData: {} },
      existingPromise: { id: "promise-1" }
    });
    await createRecordOutcome(client as never)({
      ...BASE,
      outcome: "PAYMENT_PROMISE",
      providerRef: "ref-1",
      intentMetadata: { promisedAmount: 500 }
    });
    assert.equal(cap.promiseCreated, undefined, "must not create a second promise");
  });
});
