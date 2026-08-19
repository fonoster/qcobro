import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createRecordSmsDeliveryStatus } from "./recordSmsDeliveryStatus.js";

interface Captured {
  findFirstCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

function makeClient(record: { id: string; outcome: string; channelData: unknown } | null) {
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
      outcome: "OTHER",
      channelData: { messageSid: "SM123" }
    });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "delivered",
      at: "2026-08-19T10:00:00.000Z"
    });

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "DELIVERED" });
    assert.equal(cap.update?.data.outcome, "DELIVERED");
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.deliveryStatus, "delivered");
    assert.equal(cd.messageSid, "SM123"); // existing preserved
  });

  it("undelivered → NOT_DELIVERED", async () => {
    const { client, cap } = makeClient({ id: "g-1", outcome: "OTHER", channelData: null });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "undelivered",
      at: "2026-08-19T10:00:00.000Z"
    });

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "NOT_DELIVERED" });
    assert.equal(cap.update?.data.outcome, "NOT_DELIVERED");
  });

  it("failed → NOT_DELIVERED", async () => {
    const { client } = makeClient({ id: "g-1", outcome: "OTHER", channelData: null });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "failed",
      at: "2026-08-19T10:00:00.000Z"
    });

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "NOT_DELIVERED" });
  });

  it("interim status (queued/sending/sent) updates deliveryStatus only, never finalizes", async () => {
    for (const status of ["queued", "sending", "sent"]) {
      const { client, cap } = makeClient({ id: "g-1", outcome: "OTHER", channelData: null });

      const result = await createRecordSmsDeliveryStatus(client as never)({
        providerRef: "SM123",
        status,
        at: "2026-08-19T10:00:00.000Z"
      });

      assert.equal(result.matched, true);
      assert.equal((result as { outcome: string }).outcome, "OTHER");
      assert.equal(cap.update?.data.outcome, undefined, status);
      const cd = cap.update?.data.channelData as Record<string, unknown>;
      assert.equal(cd.deliveryStatus, status);
    }
  });

  it("idempotent: a finalized outcome is never overwritten by a later callback, terminal or not", async () => {
    const { client, cap } = makeClient({ id: "g-1", outcome: "DELIVERED", channelData: {} });

    const result = await createRecordSmsDeliveryStatus(client as never)({
      providerRef: "SM123",
      status: "failed",
      at: "2026-08-19T10:05:00.000Z"
    });

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "DELIVERED" });
    assert.equal(cap.update?.data.outcome, undefined);
    // deliveryStatus still updates for visibility even though outcome is locked
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
    const { client, cap } = makeClient({ id: "g-1", outcome: "OTHER", channelData: {} });

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
