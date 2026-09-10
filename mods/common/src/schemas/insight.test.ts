import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gestionInsightSchema } from "./insight.js";

const full = {
  aiSummary: "El cliente reconoció la deuda y se comprometió a pagar el viernes.",
  aiSentiment: "POSITIVE" as const,
  aiDebtReason: "Falta de liquidez temporal",
  aiResult: "Promesa de pago",
  aiNextStep: "Enviar enlace de pago por SMS"
};

describe("gestionInsightSchema", () => {
  it("accepts a fully populated insight", () => {
    assert.equal(gestionInsightSchema.safeParse(full).success, true);
  });

  it("accepts null for aiDebtReason (no stated reason for the debt)", () => {
    const result = gestionInsightSchema.safeParse({ ...full, aiDebtReason: null });
    assert.equal(result.success, true);
    assert.equal(result.data?.aiDebtReason, null);
  });

  it("accepts null for aiSentiment, aiResult and aiNextStep too", () => {
    const result = gestionInsightSchema.safeParse({
      ...full,
      aiSentiment: null,
      aiResult: null,
      aiNextStep: null
    });
    assert.equal(result.success, true);
  });

  it("still requires a non-empty aiSummary (the cache marker / primary field)", () => {
    assert.equal(gestionInsightSchema.safeParse({ ...full, aiSummary: null }).success, false);
    assert.equal(gestionInsightSchema.safeParse({ ...full, aiSummary: "" }).success, false);
  });

  it("still rejects an empty string for a nullable text field (null, not blank)", () => {
    assert.equal(gestionInsightSchema.safeParse({ ...full, aiDebtReason: "" }).success, false);
  });

  it("rejects an out-of-enum aiSentiment", () => {
    assert.equal(gestionInsightSchema.safeParse({ ...full, aiSentiment: "ANGRY" }).success, false);
  });
});
