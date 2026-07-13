import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createRecordPrerecordedOutcome } from "./recordPrerecordedOutcome.js";

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
      outcome: "OTHER",
      channelData: { from: "+1999", to: "+1888" }
    });

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "DELIVERED" });
    assert.equal(cap.update?.data.outcome, "DELIVERED");
    assert.equal(cap.update?.data.durationSeconds, 22);
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.from, "+1999"); // existing preserved
    assert.equal(cd.scriptDurationSeconds, 30);
    assert.ok(typeof cd.endedAt === "string");
  });

  it("unanswered call → NOT_DELIVERED with zero duration", async () => {
    const { client, cap } = makeClient({ id: "g-1", outcome: "OTHER", channelData: null });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      at: "2026-07-12T10:00:00.000Z"
    });

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "NOT_DELIVERED" });
    assert.equal(cap.update?.data.durationSeconds, 0);
  });

  it("idempotent: a finalized outcome is preserved, never downgraded", async () => {
    const { client, cap } = makeClient({ id: "g-1", outcome: "DELIVERED", channelData: {} });

    const result = await createRecordPrerecordedOutcome(client as never)({
      providerRef: "call-abc",
      answered: false,
      answeredSeconds: 0,
      at: "2026-07-12T10:05:00.000Z"
    });

    assert.deepEqual(result, { matched: true, id: "g-1", outcome: "DELIVERED" });
    assert.equal(cap.update?.data.outcome, "DELIVERED");
  });

  it("returns matched:false and does not update when no gestión matches the callRef", async () => {
    const { client, cap } = makeClient(null);

    const result = await createRecordPrerecordedOutcome(client as never)(ANSWERED);

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.update, undefined);
  });

  it("rejects invalid input with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient({ id: "g-1", outcome: "OTHER", channelData: {} });

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
