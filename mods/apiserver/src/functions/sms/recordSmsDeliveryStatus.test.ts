import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createRecordSmsDeliveryStatus } from "./recordSmsDeliveryStatus.js";

interface Captured {
  findFirstCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

function makeClient(
  record: {
    id: string;
    delivery: string;
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

describe("recordSmsDeliveryStatus", () => {
  it("delivered → DELIVERED, channelData.deliveryStatus set, preserves existing channelData", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      deliveryReason: null,
      channelData: { messageSid: "SM123" }
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "delivered",
      at: "2026-08-19T10:00:00.000Z"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      delivery: "DELIVERED",
      deliveryReason: null
    });
    assert.equal(cap.update?.data.delivery, "DELIVERED");
    assert.equal(cap.update?.data.deliveryReason, undefined);
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.deliveryStatus, "delivered");
    assert.equal(cd.messageSid, "SM123"); // existing preserved
  });

  it("undelivered → FAILED with a deliveryReason derived from the default (no ErrorCode)", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      deliveryReason: null,
      channelData: null
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "undelivered",
      at: "2026-08-19T10:00:00.000Z"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      delivery: "FAILED",
      deliveryReason: "PROVIDER_ERROR"
    });
    assert.equal(cap.update?.data.delivery, "FAILED");
    assert.equal(cap.update?.data.deliveryReason, "PROVIDER_ERROR");
  });

  it("failed with ErrorCode 21614 (landline) → CHANNEL_UNSUPPORTED", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      deliveryReason: null,
      channelData: null
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "failed",
      at: "2026-08-19T10:00:00.000Z",
      errorCode: "21614"
    });

    assert.equal(result.matched, true);
    assert.equal((result as { deliveryReason: string }).deliveryReason, "CHANNEL_UNSUPPORTED");
    assert.equal(cap.update?.data.deliveryReason, "CHANNEL_UNSUPPORTED");
  });

  it("failed with ErrorCode 21211 (invalid number) → INVALID_DESTINATION", async () => {
    const { client } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      deliveryReason: null,
      channelData: null
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "failed",
      at: "2026-08-19T10:00:00.000Z",
      errorCode: "21211"
    });

    assert.equal((result as { deliveryReason: string }).deliveryReason, "INVALID_DESTINATION");
  });

  it("failed with ErrorCode 21610 (recipient opted out) → REJECTED", async () => {
    const { client } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      deliveryReason: null,
      channelData: null
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "failed",
      at: "2026-08-19T10:00:00.000Z",
      errorCode: "21610"
    });

    assert.equal((result as { deliveryReason: string }).deliveryReason, "REJECTED");
  });

  it("interim status (queued/sending/sent) updates deliveryStatus only, never finalizes", async () => {
    for (const status of ["queued", "sending", "sent"]) {
      const { client, cap } = makeClient({
        id: "g-1",
        delivery: "DISPATCHED",
        deliveryReason: null,
        channelData: null
      });

      const result = await createRecordSmsDeliveryStatus(client as never)({
        providerRef: "SM123",
        status,
        at: "2026-08-19T10:00:00.000Z"
      });

      assert.equal(result.matched, true);
      assert.equal((result as { delivery: string }).delivery, "DISPATCHED");
      assert.equal(cap.update?.data.delivery, undefined, status);
      assert.equal(cap.update?.data.deliveryReason, undefined, status);
      const cd = cap.update?.data.channelData as Record<string, unknown>;
      assert.equal(cd.deliveryStatus, status);
    }
  });

  it("idempotent: delivery never regresses — a later callback preserves an already-finalized delivery/deliveryReason", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      delivery: "DELIVERED",
      deliveryReason: null,
      channelData: {}
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "failed",
      at: "2026-08-19T10:05:00.000Z",
      errorCode: "21614"
    });

    assert.deepEqual(result, {
      matched: true,
      id: "g-1",
      delivery: "DELIVERED",
      deliveryReason: null
    });
    assert.equal(cap.update?.data.delivery, undefined);
    assert.equal(cap.update?.data.deliveryReason, undefined);
    // deliveryStatus still updates for visibility even though delivery is locked
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.deliveryStatus, "failed");
  });

  it("returns matched:false and does not update when no gestión matches the MessageSid", async () => {
    const { client, cap } = makeClient(null);

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "delivered",
      at: "2026-08-19T10:00:00.000Z"
    });

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.update, undefined);
  });

  it("rejects invalid input with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient({
      id: "g-1",
      delivery: "DISPATCHED",
      deliveryReason: null,
      channelData: {}
    });

    await assert.rejects(
      () =>
        createRecordSmsDeliveryStatus(client as never)({
          providerRef: "",
          status: "",
          at: ""
        } as never),
      (err) => err instanceof ValidationError
    );
    assert.equal(cap.findFirstCalled, undefined);
    assert.equal(cap.update, undefined);
  });
});
