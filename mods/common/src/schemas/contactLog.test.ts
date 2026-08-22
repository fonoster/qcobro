import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactLogSchema } from "./contactLog.js";

const base = {
  portfolioAccountId: "acc-1",
  agentType: "VOICE_PRERECORDED" as const,
  contactedAt: "2026-08-21T10:00:00.000Z"
};

describe("createContactLogSchema — VOICE_PRERECORDED camino/resultado carve-out", () => {
  it("accepts entrega only, with no camino/resultado (the default, no-menu case)", () => {
    const result = createContactLogSchema.safeParse({ ...base, entrega: "DELIVERED" });
    assert.equal(result.success, true);
  });

  it("accepts camino ENGAGED (a repeat press)", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      entrega: "DELIVERED",
      camino: "ENGAGED"
    });
    assert.equal(result.success, true);
  });

  it("accepts camino ENGAGED + resultado OPT_OUT together (an opt-out press)", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: "OPT_OUT"
    });
    assert.equal(result.success, true);
  });

  it("rejects camino ABANDONED — unreachable on this channel even with the carve-out", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      entrega: "DELIVERED",
      camino: "ABANDONED"
    });
    assert.equal(result.success, false);
  });

  it("rejects camino VOICEMAIL — unreachable on this channel even with the carve-out", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      entrega: "DELIVERED",
      camino: "VOICEMAIL"
    });
    assert.equal(result.success, false);
  });

  it("rejects any resultado other than OPT_OUT — e.g. PAYMENT_PROMISE stays unreachable", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      entrega: "DELIVERED",
      resultado: "PAYMENT_PROMISE"
    });
    assert.equal(result.success, false);
  });

  it("resultado OPT_OUT is accepted without camino — the two fields stay independent", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      entrega: "DELIVERED",
      resultado: "OPT_OUT"
    });
    assert.equal(result.success, true);
  });

  it("SMS still rejects camino/resultado entirely — the carve-out is VOICE_PRERECORDED-only", () => {
    const result = createContactLogSchema.safeParse({
      ...base,
      agentType: "SMS",
      entrega: "DELIVERED",
      camino: "ENGAGED"
    });
    assert.equal(result.success, false);
  });
});
