import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecordOutcome } from "./recordOutcome.js";

interface Cap {
  created?: Record<string, unknown>;
  updated?: { id: string; data: Record<string, unknown> };
  objectiveCreated?: Record<string, unknown>;
}

function makeClient(opts: {
  existing?: Record<string, unknown> | null;
  existingObjectives?: Record<string, unknown>[];
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
    objective: {
      findMany: async () => (opts.existingObjectives ?? []) as never,
      create: async (args: { data: Record<string, unknown> }) => {
        cap.objectiveCreated = args.data;
        return { id: "obj", ...args.data } as never;
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
      existing: { id: "log-1", outcome: "OTHER", providerRef: "ref-1", channelData: { from: "x" } }
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
    // Objective created for the payment promise.
    assert.equal(cap.objectiveCreated?.type, "PAYMENT_PROMISE");
  });

  it("never downgrades a real outcome with a dispatch-time OTHER", async () => {
    const { client, cap } = makeClient({
      existing: { id: "log-1", outcome: "PAYMENT_PROMISE", providerRef: "ref-1", channelData: {} }
    });
    await createRecordOutcome(client as never)({ ...BASE, outcome: "OTHER", providerRef: "ref-1" });
    assert.equal(cap.updated?.data.outcome, "PAYMENT_PROMISE", "kept the real outcome");
  });

  it("does not duplicate an objective on re-delivery", async () => {
    const { client, cap } = makeClient({
      existing: { id: "log-1", outcome: "PAYMENT_PROMISE", providerRef: "ref-1", channelData: {} },
      existingObjectives: [{ id: "obj-1", type: "PAYMENT_PROMISE" }]
    });
    await createRecordOutcome(client as never)({
      ...BASE,
      outcome: "PAYMENT_PROMISE",
      providerRef: "ref-1",
      intentMetadata: { promisedAmount: 500 }
    });
    assert.equal(cap.objectiveCreated, undefined, "must not create a second objective");
  });
});
