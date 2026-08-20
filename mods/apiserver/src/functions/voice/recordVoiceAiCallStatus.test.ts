import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createRecordVoiceAiCallStatus } from "./recordVoiceAiCallStatus.js";

interface Captured {
  findFirstCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

function makeClient(
  record: {
    id: string;
    entrega: string;
    deliveryReason: string | null;
    channelData: unknown;
  } | null
) {
  const cap: Captured = {};
  const client = {
    accountContactLog: {
      findFirst: async () => {
        cap.findFirstCalled = true;
        return record;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.update = args;
        return {} as never;
      }
    }
  };
  return { client, cap };
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
    assert.equal(cap.update?.data.entrega, "FAILED");
    assert.equal(cap.update?.data.deliveryReason, "NO_ANSWER");
    assert.equal(cap.update?.data.durationSeconds, 0);
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
    assert.equal(cap.update?.data.entrega, "DELIVERED");
    assert.equal(cap.update?.data.deliveryReason, undefined);
    assert.equal(cap.update?.data.durationSeconds, 47);
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.appRef, "app-1"); // existing preserved
  });

  it("idempotent: entrega never regresses — once DELIVERED (e.g. via the autopilot webhook), a later CDR completion preserves it", async () => {
    const { client, cap } = makeClient({
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
    assert.equal(cap.update?.data.entrega, undefined);
    assert.equal(cap.update?.data.deliveryReason, undefined);
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
    assert.equal(cap.update, undefined);
  });

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
    assert.equal(cap.update, undefined);
  });
});
