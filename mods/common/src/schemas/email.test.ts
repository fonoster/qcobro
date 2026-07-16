import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailAutopilotDecisionSchema } from "./email.js";

describe("emailAutopilotDecisionSchema", () => {
  it("accepts outcome/replyBody as null, matching Gemini's JSON-mode output for a plain reply", () => {
    const parsed = emailAutopilotDecisionSchema.parse({
      action: "reply",
      replyBody: null,
      outcome: null,
      objective: null
    });
    assert.equal(parsed.outcome, null);
    assert.equal(parsed.replyBody, null);
  });

  it("still accepts outcome/replyBody omitted entirely", () => {
    const parsed = emailAutopilotDecisionSchema.parse({ action: "ignore" });
    assert.equal(parsed.outcome, undefined);
    assert.equal(parsed.replyBody, undefined);
  });

  it("still accepts a real outcome string", () => {
    const parsed = emailAutopilotDecisionSchema.parse({
      action: "resolve",
      outcome: "PAYMENT_PROMISE",
      objective: { type: "PAYMENT_PROMISE", amount: 100, dueDate: "2026-08-01" }
    });
    assert.equal(parsed.outcome, "PAYMENT_PROMISE");
    assert.equal(parsed.objective?.amount, 100);
  });

  it("rejects a non-string outcome", () => {
    assert.throws(() => emailAutopilotDecisionSchema.parse({ action: "reply", outcome: 42 }));
  });
});
