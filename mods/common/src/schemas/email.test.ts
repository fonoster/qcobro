import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailAutopilotDecisionSchema } from "./email.js";

describe("emailAutopilotDecisionSchema", () => {
  it("accepts resultado/replyBody as null, matching Gemini's JSON-mode output for a plain reply", () => {
    const parsed = emailAutopilotDecisionSchema.parse({
      action: "reply",
      replyBody: null,
      resultado: null,
      objective: null
    });
    assert.equal(parsed.resultado, null);
    assert.equal(parsed.replyBody, null);
  });

  it("still accepts resultado/replyBody omitted entirely", () => {
    const parsed = emailAutopilotDecisionSchema.parse({ action: "ignore" });
    assert.equal(parsed.resultado, undefined);
    assert.equal(parsed.replyBody, undefined);
  });

  it("still accepts a real resultado string", () => {
    const parsed = emailAutopilotDecisionSchema.parse({
      action: "resolve",
      resultado: "PAYMENT_PROMISE",
      objective: { amount: 100, dueDate: "2026-08-01" }
    });
    assert.equal(parsed.resultado, "PAYMENT_PROMISE");
    assert.equal(parsed.objective?.amount, 100);
  });

  it("rejects a non-string resultado", () => {
    assert.throws(() => emailAutopilotDecisionSchema.parse({ action: "reply", resultado: 42 }));
  });
});
