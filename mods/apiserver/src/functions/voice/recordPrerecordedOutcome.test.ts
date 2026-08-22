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

interface Captured {
  findFirstCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

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
  const client = {
    accountContactLog: {
      findFirst: async () => {
        cap.findFirstCalled = true;
        return record ? { deliveryReason: null, camino: null, resultado: null, ...record } : null;
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
      deliveryReason: null,
      camino: null,
      resultado: null
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
      deliveryReason: "NO_ANSWER",
      camino: null,
      resultado: null
    });
    assert.equal(cap.update?.data.entrega, "FAILED");
    assert.equal(cap.update?.data.deliveryReason, "NO_ANSWER");
    assert.equal(cap.update?.data.durationSeconds, 0);
  });

  /** No DTMF menu configured (the common case): neither axis is ever written. */
  it("never writes camino or resultado when the completion carries neither", async () => {
    const { client, cap } = makeClient({ id: "g-1", entrega: "DISPATCHED", channelData: {} });

    await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.equal(cap.update?.data.camino, undefined);
    assert.equal(cap.update?.data.resultado, undefined);
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
    assert.equal(cap.update?.data.camino, "ENGAGED");
    assert.equal(cap.update?.data.resultado, undefined);
    const cd = cap.update?.data.channelData as Record<string, unknown>;
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
    assert.equal(cap.update?.data.camino, "ENGAGED");
    assert.equal(cap.update?.data.resultado, "OPT_OUT");
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

  it("idempotent: a duplicate completion does not overwrite a recorded camino/resultado", async () => {
    const { client, cap } = makeClient({
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
    assert.equal(cap.update?.data.camino, undefined, "camino not rewritten");
    assert.equal(cap.update?.data.resultado, undefined, "resultado not rewritten");
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
