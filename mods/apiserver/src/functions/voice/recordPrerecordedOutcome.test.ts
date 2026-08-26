import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  type Camino,
  type DeliveryReason,
  type Entrega,
  type Resultado
} from "@qcobro/common";
import { createRecordPrerecordedOutcome } from "./recordPrerecordedOutcome.js";

interface Row {
  id: string;
  entrega: Entrega;
  deliveryReason: DeliveryReason | null;
  camino: Camino | null;
  resultado: Resultado | null;
  channelData: unknown;
}

interface Captured {
  findFirstCalled?: boolean;
  updateMany?: { where: { id: string; entrega: string }; data: Record<string, unknown> };
}

/**
 * Simulates the real guard: `updateMany` only applies (and reports count: 1) when the
 * row's CURRENT entrega still matches `where.entrega` at write time — re-checked against
 * live state, not whatever an earlier `findFirst` saw. This is what actually closes the
 * TOCTOU race between the in-process VoiceServer completion and
 * `voiceCompletionTimeoutSweep`.
 */
function makeClient(
  record: {
    id: string;
    entrega: Entrega;
    deliveryReason?: DeliveryReason | null;
    camino?: Camino | null;
    resultado?: Resultado | null;
    channelData: unknown;
  } | null
) {
  const cap: Captured = {};
  let row: Row | null = record
    ? { deliveryReason: null, camino: null, resultado: null, ...record }
    : null;
  const client = {
    accountContactLog: {
      findFirst: async () => {
        cap.findFirstCalled = true;
        return row ? { ...row } : null;
      },
      updateMany: async (args: {
        where: { id: string; entrega: string };
        data: Record<string, unknown>;
      }) => {
        cap.updateMany = args;
        if (!row || row.id !== args.where.id || row.entrega !== args.where.entrega) {
          return { count: 0 };
        }
        row = { ...row, ...args.data } as Row;
        return { count: 1 };
      }
    }
  };
  return { client, cap, getRow: () => row };
}

const ANSWERED = {
  providerRef: "call-abc",
  answered: true,
  answeredSeconds: 22,
  scriptDurationSeconds: 30,
  at: "2026-07-12T10:00:00.000Z"
};

describe("recordPrerecordedOutcome", () => {
  it("answered call → DELIVERED with duration, preserves channelData, stores script length", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      entrega: "DISPATCHED",
      channelData: { from: "+1999", to: "+1888" }
    });

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      entrega: "DELIVERED",
      deliveryReason: null,
      camino: null,
      resultado: null
    });
    assert.equal(cap.updateMany?.data.entrega, "DELIVERED");
    assert.equal(cap.updateMany?.data.durationSeconds, 22);
    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.from, "+1999"); // existing preserved
    assert.equal(cd.scriptDurationSeconds, 30);
    assert.ok(typeof cd.endedAt === "string");
  });

  it("unanswered call → FAILED with its reason and zero duration", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: null });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      deliveryReason: "NO_ANSWER",
      at: "2026-07-12T10:00:00.000Z"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      entrega: "FAILED",
      deliveryReason: "NO_ANSWER",
      camino: null,
      resultado: null
    });
    assert.equal(cap.updateMany?.data.entrega, "FAILED");
    assert.equal(cap.updateMany?.data.deliveryReason, "NO_ANSWER");
    assert.equal(cap.updateMany?.data.durationSeconds, 0);
  });

  /** No DTMF menu configured (the common case): neither axis ends up set. */
  it("leaves camino/resultado null when the completion carries neither", async () => {
    const { client } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.equal(result.matched && result.camino, null);
    assert.equal(result.matched && result.resultado, null);
  });

  it("a repeat press sets camino ENGAGED only, and stores repeatCount", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      camino: "ENGAGED",
      repeatCount: 2
    });

    assert.equal(result.matched && result.camino, "ENGAGED");
    assert.equal(result.matched && result.resultado, null);
    assert.equal(cap.updateMany?.data.camino, "ENGAGED");
    assert.equal(cap.updateMany?.data.resultado, null);
    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.repeatCount, 2);
  });

  it("an opt-out press sets camino ENGAGED and resultado OPT_OUT", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      camino: "ENGAGED",
      resultado: "OPT_OUT"
    });

    assert.equal(result.matched && result.camino, "ENGAGED");
    assert.equal(result.matched && result.resultado, "OPT_OUT");
    assert.equal(cap.updateMany?.data.camino, "ENGAGED");
    assert.equal(cap.updateMany?.data.resultado, "OPT_OUT");
  });

  it("idempotent: entrega only advances, a finalized value is never downgraded", async () => {
    const { client, getRow } = makeClient({ id: "g-1", entrega: "DELIVERED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      deliveryReason: "NO_ANSWER",
      at: "2026-07-12T10:05:00.000Z"
    });

    assert.equal(result.matched && result.entrega, "DELIVERED");
    assert.equal(getRow()?.entrega, "DELIVERED", "entrega not rewritten");
    assert.equal(getRow()?.deliveryReason, null, "no reason on a delivered call");
  });

  it("idempotent: a duplicate completion does not overwrite a recorded camino/resultado", async () => {
    const { client, getRow } = makeClient({
      id: "g-1",
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: "OPT_OUT",
      channelData: {}
    });

    const result = await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      camino: "ENGAGED",
      resultado: "OPT_OUT"
    });

    assert.equal(result.matched && result.camino, "ENGAGED");
    assert.equal(result.matched && result.resultado, "OPT_OUT");
    assert.equal(getRow()?.camino, "ENGAGED", "camino not rewritten");
    assert.equal(getRow()?.resultado, "OPT_OUT", "resultado not rewritten");
  });

  it(
    "concurrent finalize race: a real 'answered' completion and the timeout sweep's " +
      "'unanswered' completion both read DISPATCHED before either writes — whichever " +
      "write lands LAST must not clobber the other's already-committed result",
    async () => {
      // Models the real production race: `recordPrerecordedOutcome` is invoked both from
      // the in-process VoiceServer completion (answered:true, on pickup) and from
      // `voiceCompletionTimeoutSweep` (answered:false), reading the SAME row. Both
      // `findFirst` calls happen while the row is still DISPATCHED (the actual race
      // window in production); the real completion's write commits first (DELIVERED,
      // 22s). The sweep's write — decided from its own earlier, now-stale read — is held
      // back and only applied afterward, reproducing "read first, write last." Because the
      // write is guarded by `where.entrega: "DISPATCHED"` re-checked against live state,
      // it must find the row already DELIVERED and no-op instead of clobbering it.
      const { client, getRow } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });
      let releaseSweepWrite: () => void = () => {};
      const sweepWriteGate = new Promise<void>((resolve) => {
        releaseSweepWrite = resolve;
      });
      const rawUpdateMany = client.accountContactLog.updateMany;
      client.accountContactLog.updateMany = (async (args: Parameters<typeof rawUpdateMany>[0]) => {
        if (args.data.deliveryReason === "PROVIDER_ERROR") {
          await sweepWriteGate;
        }
        return rawUpdateMany(args);
      }) as typeof rawUpdateMany;

      const record = createRecordPrerecordedOutcome(client as never);

      const sweepCall = record({
        providerRef: "call-abc",
        answered: false,
        answeredSeconds: 0,
        deliveryReason: "PROVIDER_ERROR",
        at: "2026-08-24T10:00:10.000Z"
      });
      const webhookCall = record({ ...ANSWERED });

      await webhookCall; // the real completion commits DELIVERED first
      releaseSweepWrite(); // only now does the sweep's already-decided write land
      const sweepResult = await sweepCall;

      assert.equal(
        getRow()?.entrega,
        "DELIVERED",
        "a call that was actually answered must not end up FAILED because the sweep's " +
          "write physically landed after the real completion's"
      );
      assert.equal(sweepResult.matched && sweepResult.entrega, "DELIVERED");
    }
  );

  it("returns matched:false and does not update when no gestión matches the callRef", async () => {
    const { client, cap } = makeClient(null);

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.updateMany, undefined);
  });

  it("rejects invalid input with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });

    await assert.rejects(
      () =>
        createRecordPrerecordedOutcome(client as never)({
          providerRef: "",
          answered: true,
          answeredSeconds: -1,
          at: ""
        } as never),
      (err) => err instanceof ValidationError
    );
    assert.equal(cap.findFirstCalled, undefined);
    assert.equal(cap.updateMany, undefined);
  });
});
