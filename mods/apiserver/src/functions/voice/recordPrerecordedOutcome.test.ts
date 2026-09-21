import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  type Path,
  type DeliveryReason,
  type Delivery,
  type Outcome
} from "@qcobro/common";
import { createRecordPrerecordedOutcome } from "./recordPrerecordedOutcome.js";

interface Row {
  id: string;
  delivery: Delivery;
  deliveryReason: DeliveryReason | null;
  path: Path | null;
  outcome: Outcome | null;
  channelData: unknown;
}

interface Captured {
  findFirstCalled?: boolean;
  updateMany?: { where: { id: string; delivery: string }; data: Record<string, unknown> };
}

/**
 * Simulates the real guard: `updateMany` only applies (and reports count: 1) when the
 * row's CURRENT delivery still matches `where.delivery` at write time — re-checked against
 * live state, not whatever an earlier `findFirst` saw. This is what actually closes the
 * TOCTOU race between the in-process VoiceServer completion and
 * `voiceCompletionTimeoutSweep`.
 */
function makeClient(
  record: {
    id: string;
    delivery: Delivery;
    deliveryReason?: DeliveryReason | null;
    path?: Path | null;
    outcome?: Outcome | null;
    channelData: unknown;
  } | null
) {
  const cap: Captured = {};
  let row: Row | null = record
    ? { deliveryReason: null, path: null, outcome: null, ...record }
    : null;
  const client = {
    accountContactLog: {
      findFirst: async () => {
        cap.findFirstCalled = true;
        return row ? { ...row } : null;
      },
      updateMany: async (args: {
        where: { id: string; delivery: string };
        data: Record<string, unknown>;
      }) => {
        cap.updateMany = args;
        if (!row || row.id !== args.where.id || row.delivery !== args.where.delivery) {
          return { count: 0 };
        }
        row = { ...row, ...args.data } as Row;
        return { count: 1 };
      }
    }
  };
  return { client, cap, getRow: () => row };
}

/** A normal successful call: picked up AND the message played out to the end. */
const ANSWERED = {
  providerRef: "call-abc",
  answered: true,
  scriptCompleted: true,
  answeredSeconds: 22,
  scriptDurationSeconds: 30,
  at: "2026-07-12T10:00:00.000Z"
};

describe("recordPrerecordedOutcome", () => {
  it("answered call → DELIVERED with duration, preserves channelData, stores script length", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      channelData: { from: "+1999", to: "+1888" }
    });

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      delivery: "DELIVERED",
      deliveryReason: null,
      path: null,
      outcome: null
    });
    assert.equal(cap.updateMany?.data.delivery, "DELIVERED");
    assert.equal(cap.updateMany?.data.durationSeconds, 22);
    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.from, "+1999"); // existing preserved
    assert.equal(cd.scriptDurationSeconds, 30);
    assert.ok(typeof cd.endedAt === "string");
  });

  it("stores the recording's file name, so the console can compose its URL on read", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: null });

    await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      recordingFile: "app-1_1756742400.123.wav"
    });

    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.recordingFile, "app-1_1756742400.123.wav");
    // The name, never a URL: the recordings host is a deployment setting resolved on read.
    assert.equal(cd.recordingUrl, undefined);
  });

  it("records a file name even when the script never played — that call still has audio", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: null });

    await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      scriptCompleted: false,
      recordingFile: "app-1_1756742400.999.wav"
    });

    assert.equal(cap.updateMany?.data.delivery, "FAILED");
    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.recordingFile, "app-1_1756742400.999.wav");
  });

  it("unanswered call → FAILED with its reason and zero duration", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: null });

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
      delivery: "FAILED",
      deliveryReason: "NO_ANSWER",
      path: null,
      outcome: null
    });
    assert.equal(cap.updateMany?.data.delivery, "FAILED");
    assert.equal(cap.updateMany?.data.deliveryReason, "NO_ANSWER");
    assert.equal(cap.updateMany?.data.durationSeconds, 0);
  });

  it("answered but the script never played → FAILED/UNREACHABLE, keeping the real duration", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: true,
      scriptCompleted: false,
      answeredSeconds: 30,
      at: "2026-07-12T10:00:00.000Z"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      delivery: "FAILED",
      deliveryReason: "UNREACHABLE",
      path: null,
      outcome: null
    });
    // The line was open for 30 real seconds even though nothing was heard.
    assert.equal(cap.updateMany?.data.durationSeconds, 30);
  });

  /**
   * The two shapes seen on 2026-08-30. Both picked up; neither heard anything. Reporting
   * either as DELIVERED tells an operator the account holder was contacted, and the second
   * would read as the longest successful contact of the day.
   */
  it("incident: a sub-second false answer that played nothing is not a delivery", async () => {
    const { client } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: true,
      scriptCompleted: false,
      answeredSeconds: 1,
      at: "2026-08-30T18:08:56.000Z"
    });

    assert.equal(result.matched && result.delivery, "FAILED");
    assert.equal(result.matched && result.deliveryReason, "UNREACHABLE");
  });

  it("incident: 110 seconds of silence is not a delivery", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: true,
      scriptCompleted: false,
      answeredSeconds: 110,
      at: "2026-08-30T18:11:00.000Z"
    });

    assert.equal(result.matched && result.delivery, "FAILED");
    assert.equal(result.matched && result.deliveryReason, "UNREACHABLE");
    assert.equal(result.matched && result.path, null);
    assert.equal(cap.updateMany?.data.durationSeconds, 110);
  });

  it("an explicit deliveryReason still wins over the answered-but-silent default", async () => {
    const { client } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: true,
      scriptCompleted: false,
      answeredSeconds: 4,
      deliveryReason: "PROVIDER_ERROR",
      at: "2026-07-12T10:00:00.000Z"
    });

    assert.equal(result.matched && result.deliveryReason, "PROVIDER_ERROR");
  });

  /** No DTMF menu configured (the common case): neither axis ends up set. */
  it("leaves path/outcome null when the completion carries neither", async () => {
    const { client } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.equal(result.matched && result.path, null);
    assert.equal(result.matched && result.outcome, null);
  });

  it("a repeat press sets path ENGAGED only, and stores repeatCount", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      path: "ENGAGED",
      repeatCount: 2
    });

    assert.equal(result.matched && result.path, "ENGAGED");
    assert.equal(result.matched && result.outcome, null);
    assert.equal(cap.updateMany?.data.path, "ENGAGED");
    assert.equal(cap.updateMany?.data.outcome, null);
    const cd = cap.updateMany?.data.channelData as Record<string, unknown>;
    assert.equal(cd.repeatCount, 2);
  });

  it("an opt-out press sets path ENGAGED and outcome OPT_OUT", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      path: "ENGAGED",
      outcome: "OPT_OUT"
    });

    assert.equal(result.matched && result.path, "ENGAGED");
    assert.equal(result.matched && result.outcome, "OPT_OUT");
    assert.equal(cap.updateMany?.data.path, "ENGAGED");
    assert.equal(cap.updateMany?.data.outcome, "OPT_OUT");
  });

  it("a detected machine hang-up records FAILED/UNREACHABLE with path ANSWERED_BY_MACHINE", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: true,
      scriptCompleted: false,
      answeredSeconds: 1,
      at: "2026-07-12T10:00:00.000Z",
      path: "ANSWERED_BY_MACHINE"
    });

    assert.equal(result.matched && result.delivery, "FAILED");
    assert.equal(result.matched && result.deliveryReason, "UNREACHABLE");
    assert.equal(result.matched && result.path, "ANSWERED_BY_MACHINE");
    assert.equal(result.matched && result.outcome, null);
    assert.equal(cap.updateMany?.data.durationSeconds, 1);
  });

  it("idempotent: delivery only advances, a finalized value is never downgraded", async () => {
    const { client, getRow } = makeClient({ id: "g-1", delivery: "DELIVERED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      deliveryReason: "NO_ANSWER",
      at: "2026-07-12T10:05:00.000Z"
    });

    assert.equal(result.matched && result.delivery, "DELIVERED");
    assert.equal(getRow()?.delivery, "DELIVERED", "delivery not rewritten");
    assert.equal(getRow()?.deliveryReason, null, "no reason on a delivered call");
  });

  it("idempotent: a duplicate completion does not overwrite a recorded path/outcome", async () => {
    const { client, getRow } = makeClient({
      id: "g-1",
      delivery: "DELIVERED",
      path: "ENGAGED",
      outcome: "OPT_OUT",
      channelData: {}
    });

    const result = await createRecordPrerecordedOutcome(client as never)({
      ...ANSWERED,
      path: "ENGAGED",
      outcome: "OPT_OUT"
    });

    assert.equal(result.matched && result.path, "ENGAGED");
    assert.equal(result.matched && result.outcome, "OPT_OUT");
    assert.equal(getRow()?.path, "ENGAGED", "path not rewritten");
    assert.equal(getRow()?.outcome, "OPT_OUT", "outcome not rewritten");
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
      // write is guarded by `where.delivery: "DISPATCHED"` re-checked against live state,
      // it must find the row already DELIVERED and no-op instead of clobbering it.
      const { client, getRow } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });
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
        getRow()?.delivery,
        "DELIVERED",
        "a call that was actually answered must not end up FAILED because the sweep's " +
          "write physically landed after the real completion's"
      );
      assert.equal(sweepResult.matched && sweepResult.delivery, "DELIVERED");
    }
  );

  it("returns matched:false and does not update when no gestión matches the callRef", async () => {
    const { client, cap } = makeClient(null);

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.updateMany, undefined);
  });

  it("rejects invalid input with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient({ id: "g-1", delivery: "DISPATCHED", channelData: {} });

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
