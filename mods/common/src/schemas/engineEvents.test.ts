import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { engineEventSchema, maskRecipient } from "./engineEvents.js";

describe("maskRecipient", () => {
  it("keeps only the last 4 characters of a phone", () => {
    assert.equal(maskRecipient("+18095551234"), "********1234");
  });

  it("masks very short identifiers entirely", () => {
    assert.equal(maskRecipient("1234"), "****");
    assert.equal(maskRecipient("12"), "**");
  });

  it("keeps the first character and domain of an email", () => {
    assert.equal(maskRecipient("maria.perez@example.com"), "m***@example.com");
  });
});

describe("engineEventSchema", () => {
  it("accepts a dispatch.failed event with the full correlation spine", () => {
    const parsed = engineEventSchema.parse({
      id: "evt_1",
      at: "2026-07-06T10:00:00.000Z",
      tickId: "tick_1",
      seq: 4,
      kind: "dispatch.failed",
      workspaceRef: "ws_1",
      campaignId: "cmp_1",
      portfolioAccountId: "acc_1",
      channel: "SMS",
      latencyMs: 120,
      errorClass: "Error",
      errorMessage: "boom",
      toMasked: "********1234"
    });
    assert.equal(parsed.kind, "dispatch.failed");
  });

  it("rejects a workspace-scoped event without workspaceRef", () => {
    const result = engineEventSchema.safeParse({
      id: "evt_1",
      at: "2026-07-06T10:00:00.000Z",
      kind: "account.decided",
      campaignId: "cmp_1",
      portfolioAccountId: "acc_1",
      decision: "dispatched"
    });
    assert.equal(result.success, false);
  });
});
