import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createRecordVoiceAiCallStatus } from "./recordVoiceAiCallStatus.js";

interface Row {
  id: string;
  entrega: string;
  deliveryReason: string | null;
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
 * TOCTOU race between the live completion webhook and `voiceCompletionTimeoutSweep`.
 */
function makeClient(record: Row | null) {
  const cap: Captured = {};
  let row = record ? { ...record } : null;
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

describe("recordVoiceAiCallStatus", () => {
  it("terminal tracking failure → FAILED with deliveryReason and zero duration", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      entrega: "DISPATCHED",
      deliveryReason: null,
      channelData: null
    });

    const result = await createRecordVoiceAiCallStatus(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      at: "2026-08-18T10:00:00.000Z",
      deliveryReason: "NO_ANSWER"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      entrega: "FAILED",
      deliveryReason: "NO_ANSWER"
    });
    assert.equal(cap.updateMany?.data.entrega, "FAILED");
    assert.equal(cap.updateMany?.data.deliveryReason, "NO_ANSWER");
    assert.equal(cap.updateMany?.data.durationSeconds, 0);
    assert.equal(cap.updateMany?.where.entrega, "DISPATCHED");
  });

  it("CDR recovery, answered → DELIVERED with the real duration, no deliveryReason", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      entrega: "DISPATCHED",
      deliveryReason: null,
      channelData: { appRef: "app-1" }
    });

    const result = await createRecordVoiceAiCallStatus(client as never)({
      providerRef: "call-abc",
      answered: true,
      answeredSeconds: 47,
      at: "2026-08-18T10:00:00.000Z"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      entrega: "DELIVERED",
      deliveryReason: null
    });
    assert.equal(cap.updateMany?.data.entrega, "DELIVERED");
    assert.equal(cap.updateMany?.data.deliveryReason, null);
    assert.equal(cap.updateMany?.data.durationSeconds, 47);
    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.appRef, "app-1"); // existing preserved
  });

  it("idempotent: entrega never regresses — once DELIVERED (e.g. via the autopilot webhook), a later CDR completion preserves it", async () => {
    const { client, getRow } = makeClient({
      id: "g-1",
      entrega: "DELIVERED",
      deliveryReason: null,
      channelData: {}
    });

    const result = await createRecordVoiceAiCallStatus(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      at: "2026-08-18T10:05:00.000Z",
      deliveryReason: "NO_ANSWER"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      entrega: "DELIVERED",
      deliveryReason: null
    });
    // The guarded updateMany is attempted (where.entrega: "DISPATCHED") but the row is
    // already DELIVERED, so it must not actually apply.
    assert.equal(getRow()?.entrega, "DELIVERED");
    assert.equal(getRow()?.deliveryReason, null);
  });

  it("returns matched:false and does not update when no gestión matches the call ref", async () => {
    const { client, cap } = makeClient(null);

    const result = await createRecordVoiceAiCallStatus(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      at: "2026-08-18T10:00:00.000Z"
    });

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.updateMany, undefined);
  });

  it(
    "concurrent finalize race: a real 'answered' completion and the timeout sweep's " +
      "'unanswered' completion both read DISPATCHED before either writes — whichever write " +
      "lands LAST must not clobber the other's already-committed result",
    async () => {
      // Models the real production race: `recordVoiceAiCallStatus` is invoked both from the
      // live `conversation.ended` webhook (answered:true) and from
      // `voiceCompletionTimeoutSweep` (answered:false), reading the SAME row. Both
      // `findFirst` calls happen while the row is still DISPATCHED (the actual race window
      // in production); the webhook's write commits first (DELIVERED, 47s). The sweep's
      // write — decided from its own earlier, now-stale read — is held back and only
      // applied afterward, reproducing "read first, write last." Because the write is
      // guarded by `where.entrega: "DISPATCHED"` re-checked against live state, it must
      // find the row already DELIVERED and no-op instead of clobbering it.
      const { client, getRow } = makeClient({
        id: "g-1",
        entrega: "DISPATCHED",
        deliveryReason: null,
        channelData: {}
      });
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

      const record = createRecordVoiceAiCallStatus(client as never);

      const sweepCall = record({
        providerRef: "call-abc",
        answered: false,
        answeredSeconds: 0,
        at: "2026-08-24T10:00:10.000Z",
        deliveryReason: "PROVIDER_ERROR"
      });
      const webhookCall = record({
        providerRef: "call-abc",
        answered: true,
        answeredSeconds: 47,
        at: "2026-08-24T10:00:00.000Z"
      });

      await webhookCall; // the real completion commits DELIVERED first
      releaseSweepWrite(); // only now does the sweep's already-decided write land
      const sweepResult = await sweepCall;

      assert.equal(
        getRow()?.entrega,
        "DELIVERED",
        "a call that was actually answered must not end up FAILED because the sweep's " +
          "write physically landed after the real completion's"
      );
      assert.equal(getRow()?.deliveryReason, null);
      // The sweep's own result must reflect the state that actually won, not FAILED.
      assert.equal(sweepResult.matched && sweepResult.entrega, "DELIVERED");
    }
  );

  it("rejects invalid input with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      entrega: "DISPATCHED",
      deliveryReason: null,
      channelData: {}
    });

    await assert.rejects(
      () =>
        createRecordVoiceAiCallStatus(client as never)({
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
