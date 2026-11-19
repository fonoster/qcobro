import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecordVoiceAiCallStatus } from "./recordVoiceAiCallStatus.js";
import { createIngestVoiceEvent } from "./ingestVoiceEvent.js";
import { createRecordOutcome } from "../campaigns/recordOutcome.js";

type Row = Record<string, unknown> & { id: string; delivery: string };
type ViewName = "decision" | "ended" | "ingest";

/**
 * One AccountContactLog row shared by three client views, like three requests against the
 * same Postgres row. Writes merge only the columns they name (a single UPDATE); `update`
 * and `updateMany` re-check their `where` against the live row at write time, including a
 * jsonb `{ equals }` filter. `hold(view)` pauses that view on its next write, after its read.
 */
function makeStore(
  channelData: Record<string, unknown> = { transcriptStoredAt: "2026-11-19T10:00:00.500Z" }
) {
  let row: Row = {
    id: "g-1",
    providerRef: "call-1",
    agentType: "VOICE_AI",
    delivery: "DISPATCHED",
    deliveryReason: null,
    path: null,
    outcome: null,
    durationSeconds: null,
    channelData
  };
  const promises: Record<string, unknown>[] = [];
  const holds = new Map<ViewName, { gate: Promise<void>; reached: () => void }>();

  const matches = (where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "providerRef" || k === "agentType") return true;
      if (v && typeof v === "object" && "equals" in v) {
        return JSON.stringify(row[k]) === JSON.stringify((v as { equals: unknown }).equals);
      }
      return row[k] === v;
    });

  function view(name: ViewName) {
    const pause = async () => {
      const h = holds.get(name);
      if (!h) return;
      holds.delete(name);
      h.reached();
      await h.gate;
    };
    const client = {
      accountContactLog: {
        findFirst: async () => structuredClone(row),
        update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          await pause();
          if (!matches(args.where)) throw new Error("P2025: record to update not found");
          row = { ...row, ...args.data } as Row;
          return structuredClone(row);
        },
        updateMany: async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await pause();
          if (!matches(args.where)) return { count: 0 };
          row = { ...row, ...args.data } as Row;
          return { count: 1 };
        },
        create: async () => {
          throw new Error("unexpected create: the gestión already exists");
        }
      },
      portfolioAccount: { update: async () => ({}) },
      paymentPromise: {
        findFirst: async (args: { where: { contactLogId: string } }) =>
          promises.find((p) => p.contactLogId === args.where.contactLogId) ?? null,
        create: async (args: { data: Record<string, unknown> }) => {
          promises.push(args.data);
          return args.data;
        }
      },
      campaignTrigger: { findMany: async () => [] },
      campaignAccountState: { upsert: async () => ({}) },
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
    };
    return client;
  }

  return {
    decisionClient: view("decision"),
    endedClient: view("ended"),
    ingestClient: view("ingest"),
    get: () => row,
    promises,
    hold: (name: ViewName) => {
      let release: () => void = () => {};
      let reached: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      const atWrite = new Promise<void>((r) => (reached = r));
      holds.set(name, { gate, reached });
      return { release, atWrite };
    }
  };
}

const ended = {
  providerRef: "call-1",
  answered: true,
  answeredSeconds: 42,
  at: "2026-11-19T10:00:00.000Z"
};
const decision = {
  portfolioAccountId: "acc-1",
  agentType: "VOICE_AI" as const,
  contactedAt: "2026-11-19T10:00:01.000Z",
  delivery: "DISPATCHED" as const,
  path: "ENGAGED" as const,
  outcome: "PAYMENT_PROMISE" as const,
  providerRef: "call-1",
  intentMetadata: { promisedAmount: 1500, promisedDate: "2026-11-20" }
};

function assertFinal(s: ReturnType<typeof makeStore>) {
  const row = s.get();
  const channelData = row.channelData as Record<string, unknown>;
  assert.equal(row.delivery, "DELIVERED");
  assert.equal(row.deliveryReason, null);
  assert.equal(row.path, "ENGAGED");
  assert.equal(row.outcome, "PAYMENT_PROMISE");
  assert.equal(row.durationSeconds, 42);
  assert.equal(channelData.endedAt, "2026-11-19T10:00:00.000Z");
  assert.equal(channelData.transcriptStoredAt, "2026-11-19T10:00:00.500Z");
  assert.equal(s.promises.length, 1);
}

describe("call_record.sealed before call.ended (Voz IA)", { timeout: 5_000 }, () => {
  it("decision lands first, then call.ended", async () => {
    const s = makeStore();
    await createRecordOutcome(s.decisionClient as never)(decision);
    await createRecordVoiceAiCallStatus(s.endedClient as never)(ended);
    assertFinal(s);
  });

  it("call.ended lands between the decision's read and write", async () => {
    const s = makeStore();
    const h = s.hold("decision");
    const pending = createRecordOutcome(s.decisionClient as never)(decision);
    await h.atWrite;
    await createRecordVoiceAiCallStatus(s.endedClient as never)(ended);
    h.release();
    await pending;
    assertFinal(s);
  });

  it("call.ended lands first, then the decision", async () => {
    const s = makeStore();
    await createRecordVoiceAiCallStatus(s.endedClient as never)(ended);
    await createRecordOutcome(s.decisionClient as never)(decision);
    assertFinal(s);
  });

  it("the transcript is stored between call.ended's read and write", async () => {
    const s = makeStore({});
    const h = s.hold("ended");
    const pending = createRecordVoiceAiCallStatus(s.endedClient as never)(ended);
    await h.atWrite;
    await createIngestVoiceEvent(
      s.ingestClient as never,
      () => new Date("2026-11-19T10:00:00.500Z")
    )({
      callRef: "call-1",
      chatHistory: [{ ai: "Hola, le llamo por su cuota." }, { human: "Le pago mañana la cuota." }]
    });
    h.release();
    await pending;
    const row = s.get();
    const channelData = row.channelData as Record<string, unknown>;
    assert.equal(row.delivery, "DELIVERED");
    assert.equal(row.durationSeconds, 42);
    assert.equal(channelData.endedAt, "2026-11-19T10:00:00.000Z");
    assert.equal(channelData.transcriptStoredAt, "2026-11-19T10:00:00.500Z");
  });
});
