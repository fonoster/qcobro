import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactLogSchema } from "./contactLog.js";

const base = {
  portfolioAccountId: "acc-1",
  agentType: "VOICE_PRERECORDED" as const,
  contactedAt: "2026-08-21T10:00:00.000Z"
};

describe("createContactLogSchema — VOICE_PRERECORDED path/outcome carve-out", () => {
  it("accepts delivery only, with no path/outcome (the default, no-menu case)", () => {
    const result = createContactLogSchema.safeParse({ ...base, delivery: "DELIVERED" });
    assert.equal(result.success, true);
  });

  it("accepts path ENGAGED (a repeat press)", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      delivery: "DELIVERED",
      path: "ENGAGED"
    });
    assert.equal(result.success, true);
  });

  it("accepts path ENGAGED + outcome OPT_OUT together (an opt-out press)", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      delivery: "DELIVERED",
      path: "ENGAGED",
      outcome: "OPT_OUT"
    });
    assert.equal(result.success, true);
  });

  it("rejects path ABANDONED — unreachable on this channel even with the carve-out", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      delivery: "DELIVERED",
      path: "ABANDONED"
    });
    assert.equal(result.success, false);
  });

  it("accepts path ANSWERED_BY_MACHINE — a detected machine hang-up", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      delivery: "FAILED",
      deliveryReason: "UNREACHABLE",
      path: "ANSWERED_BY_MACHINE"
    });
    assert.equal(result.success, true);
  });

  it("rejects any outcome other than OPT_OUT — e.g. PAYMENT_PROMISE stays unreachable", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      delivery: "DELIVERED",
      outcome: "PAYMENT_PROMISE"
    });
    assert.equal(result.success, false);
  });

  it("outcome OPT_OUT is accepted without path — the two fields stay independent", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      delivery: "DELIVERED",
      outcome: "OPT_OUT"
    });
    assert.equal(result.success, true);
  });

  it("SMS still rejects path/outcome entirely — the carve-out is VOICE_PRERECORDED-only", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      agentType: "SMS",
      delivery: "DELIVERED",
      path: "ENGAGED"
    });
    assert.equal(result.success, false);
  });
});
