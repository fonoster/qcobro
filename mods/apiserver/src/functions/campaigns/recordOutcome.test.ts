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
    await createRecordOutcome(client as never)({
      ...BASE,
      delivery: "FAILED",
      deliveryReason: "NO_ANSWER"
    });
    assert.ok(cap.created, "should create");
    assert.equal(cap.updated, undefined, "should not update");
  });

  it("enriches the existing gestión by providerRef instead of duplicating", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        delivery: "DISPATCHED",
        deliveryReason: null,
        path: null,
        outcome: null,
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
    // The axes are independent: recording an outcome does not itself advance delivery. Proof
    // of delivery comes from the channel (a status callback, or an inbound reply in
    // ingestEmailReply / ingestWhatsAppMessage), never inferred from the outcome — a FAILED
    // delivery can legitimately carry an outcome when someone answers and hangs up.
    assert.equal(cap.updated?.data.delivery, "DISPATCHED", "delivery untouched by an outcome");
    // Merges channel data from the dispatch-time row.
    assert.deepEqual(cap.updated?.data.channelData, { from: "x" });
    // PaymentPromise created for the payment outcome with amount + dueDate.
    assert.equal(cap.promiseCreated?.amount, 500);
    assert.equal(cap.promiseCreated?.status, "PENDING");
    assert.ok(cap.promiseCreated?.dueDate, "carries a due date");
  });

  it("preserves providerMessageId when a later signal enriches the gestión", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        delivery: "DISPATCHED",
        deliveryReason: null,
        path: null,
        outcome: null,
        providerRef: "token-1",
        providerMessageId: "resend-1",
        channelData: null
      }
    });
    // An inbound reply enriches the row and knows nothing about the Resend message id.
    // `logData` rebuilds every column, so without merging forward this write would null it
    // and silently orphan every subsequent delivery/open event for that message.
    await createRecordOutcome(client as never)({
      ...BASE,
      agentType: "EMAIL",
      delivery: "DELIVERED",
      path: "ENGAGED",
      providerRef: "token-1"
    });
    assert.equal(cap.updated?.data.providerMessageId, "resend-1");
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

  it("never downgrades a recorded outcome with a later signal that carries none", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        delivery: "DELIVERED",
        deliveryReason: null,
        path: "ENGAGED",
        outcome: "PAYMENT_PROMISE",
        providerRef: "ref-1",
        channelData: {}
      }
    });
    await createRecordOutcome(client as never)({ ...BASE, providerRef: "ref-1" });
    assert.equal(cap.updated?.data.outcome, "PAYMENT_PROMISE", "kept the real outcome");
    assert.equal(cap.updated?.data.path, "ENGAGED", "kept the recorded path");
  });

  /** delivery only ever advances: once it has left DISPATCHED it is never rewritten. */
  it("never returns a finalized delivery to DISPATCHED", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        delivery: "FAILED",
        deliveryReason: "NO_ANSWER",
        path: null,
        outcome: null,
        providerRef: "ref-1",
        channelData: {}
      }
    });
    await createRecordOutcome(client as never)({
      ...BASE,
      delivery: "DISPATCHED",
      providerRef: "ref-1"
    });
    assert.equal(cap.updated?.data.delivery, "FAILED");
    assert.equal(cap.updated?.data.deliveryReason, "NO_ANSWER");
  });

  /**
   * The engine benches nobody for a wrong-party finding or an opt-out — both are recorded on
   * the gestión and nothing else. Only a settled debt sets a global flag.
   */
  it("sets no global intentStatus for WRONG_PARTY or OPT_OUT", async () => {
    for (const outcome of ["WRONG_PARTY", "OPT_OUT"] as const) {
      const intentUpdates: unknown[] = [];
      const { client } = makeClient({ existing: null });
      (client.portfolioAccount as { update: unknown }).update = async (args: {
        data: Record<string, unknown>;
      }) => {
        intentUpdates.push(args.data);
        return {} as never;
      };
      await createRecordOutcome(client as never)({ ...BASE, outcome });
      assert.deepEqual(intentUpdates, [], `${outcome} must not flag the account`);
    }
  });

  /**
   * Enrichment arrives from several sources, each knowing only its own fields: the dispatch
   * writes the template and notes, the channel webhook writes the duration, the AI pass writes
   * the insights. Whichever lands last must not erase what the others recorded — a Voz IA
   * outcome decision carrying no duration used to null the one `ingestVoiceEvent` had stored
   * moments earlier, and race the insight generator for the `ai*` columns.
   */
  it("merges enrichment forward instead of nulling what a previous signal recorded", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        delivery: "DELIVERED",
        deliveryReason: null,
        path: "ENGAGED",
        outcome: null,
        providerRef: "ref-1",
        channelData: { callSid: "call-1" },
        durationSeconds: 134,
        agentTemplateId: "tpl-1",
        notes: "Contacto manual",
        aiSummary: "El cliente reconoce la deuda.",
        aiSentiment: "POSITIVE",
        intentMetadata: { promisedAmount: 500 }
      }
    });

    // A later signal that knows only the outcome.
    await createRecordOutcome(client as never)({
      ...BASE,
      providerRef: "ref-1",
      outcome: "CALLBACK_REQUESTED"
    });

    const d = cap.updated?.data ?? {};
    assert.equal(d.outcome, "CALLBACK_REQUESTED", "the new value is applied");
    assert.equal(d.durationSeconds, 134, "duration survives");
    assert.equal(d.aiSummary, "El cliente reconoce la deuda.", "AI summary survives");
    assert.equal(d.aiSentiment, "POSITIVE", "sentiment survives");
    assert.equal(d.agentTemplateId, "tpl-1", "template survives");
    assert.equal(d.notes, "Contacto manual", "notes survive");
    assert.deepEqual(d.intentMetadata, { promisedAmount: 500 }, "intent metadata survives");
    assert.deepEqual(d.channelData, { callSid: "call-1" }, "channel data merges");
  });

  it("does not duplicate a PaymentPromise on re-delivery", async () => {
    const { client, cap } = makeClient({
      existing: {
        id: "log-1",
        delivery: "DELIVERED",
        deliveryReason: null,
        path: "ENGAGED",
        outcome: "PAYMENT_PROMISE",
        providerRef: "ref-1",
        channelData: {}
      },
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
