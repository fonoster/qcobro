import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError, type DeliveryReason, type Entrega } from "@qcobro/common";
import { createRecordPrerecordedOutcome } from "./recordPrerecordedOutcome.js";

interface Captured {
  findFirstCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

function makeClient(
  record: {
    id: string;
    entrega: Entrega;
    deliveryReason?: DeliveryReason | null;
    channelData: unknown;
  } | null
) {
  const cap: Captured = {};
  const client = {
    accountContactLog: {
      findFirst: async () => {
        cap.findFirstCalled = true;
        return record ? { deliveryReason: null, ...record } : null;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.update = args;
        return {} as never;
      }
    }
  };
  return { client, cap };
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
      deliveryReason: null
    });
    assert.equal(cap.update?.data.entrega, "DELIVERED");
    assert.equal(cap.update?.data.durationSeconds, 22);
    const cd = cap.update?.data.channelData as Record<string, unknown>;
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
      deliveryReason: "NO_ANSWER"
    });
    assert.equal(cap.update?.data.entrega, "FAILED");
    assert.equal(cap.update?.data.deliveryReason, "NO_ANSWER");
    assert.equal(cap.update?.data.durationSeconds, 0);
  });

  /** VOICE_PRERECORDED has no inbound path, so neither axis is ever written here. */
  it("never writes camino or resultado", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });

    await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.equal(cap.update?.data.camino, undefined);
    assert.equal(cap.update?.data.resultado, undefined);
  });

  it("idempotent: entrega only advances, a finalized value is never downgraded", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DELIVERED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      deliveryReason: "NO_ANSWER",
      at: "2026-07-12T10:05:00.000Z"
    });

    assert.equal(result.matched && result.entrega, "DELIVERED");
    assert.equal(cap.update?.data.entrega, undefined, "entrega not rewritten");
    assert.equal(cap.update?.data.deliveryReason, undefined, "no reason on a delivered call");
  });

  it("returns matched:false and does not update when no gestión matches the callRef", async () => {
    const { client, cap } = makeClient(null);

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.update, undefined);
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
    assert.equal(cap.update, undefined);
  });
});
