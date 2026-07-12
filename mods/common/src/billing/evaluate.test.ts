import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateBilling } from "./evaluate.js";
import { billingConfigSchema, type BillingConfig } from "../config.js";

function catalog(smsRate: number): NonNullable<BillingConfig> {
  return billingConfigSchema.parse({
    enabled: true,
    plans: [
      {
        key: "starter",
        name: { es: "Inicial" },
        monthlyPrice: 9,
        monthlyAllowance: 9,
        stripePriceId: "price_x",
        rates: {
          sms: { perMessage: smsRate },
          email: { perMessage: 0.0005 },
          whatsappMessage: { perMessage: 0.01 },
          voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
          voiceAi: { perMinute: 0.4, increments: "15/15" },
          whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
          whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
        }
      }
    ]
  }) as NonNullable<BillingConfig>;
}

const usage = (amountMicro: number) => ({
  id: "ur_1",
  workspaceRef: "ws_1",
  meter: "sms" as const,
  quantity: 1,
  unitPriceMicro: amountMicro,
  amountMicro,
  at: "2026-07-11T12:00:00.000Z"
});

const entry = (kind: "GRANT" | "USAGE_DEBIT" | "VOID" | "ADJUSTMENT", amountMicro: number) => ({
  id: `le_${kind}_${amountMicro}`,
  workspaceRef: "ws_1",
  kind,
  amountMicro,
  at: "2026-07-11T12:00:00.000Z"
});

describe("evaluateBilling", () => {
  it("passes a conserved ledger with healthy margins", () => {
    const scorecard = evaluateBilling({
      billing: catalog(0.01),
      usageRecords: [usage(10_000)],
      ledgerEntries: [entry("GRANT", 9_000_000), entry("USAGE_DEBIT", -10_000)]
    });
    assert.equal(scorecard.verdict, "pass");
  });

  it("fails BIL-1 when the ledger loses a debit", () => {
    const scorecard = evaluateBilling({
      billing: catalog(0.01),
      usageRecords: [usage(10_000)],
      ledgerEntries: [entry("GRANT", 9_000_000)]
    });
    const bil1 = scorecard.invariants.find((i) => i.id === "BIL-1");
    assert.equal(bil1?.verdict, "fail");
    assert.equal(scorecard.verdict, "fail");
  });

  it("flags an underwater SMS rate via the margin guard (BIL-5)", () => {
    const scorecard = evaluateBilling({
      billing: catalog(0.001), // below the ~0.0079 provider floor
      usageRecords: [],
      ledgerEntries: []
    });
    const bil5 = scorecard.invariants.find((i) => i.id === "BIL-5");
    assert.equal(bil5?.verdict, "fail");
    assert.ok(bil5?.details?.includes("starter.sms"));
  });

  it("flags duplicated grants for one invoice (BIL-6)", () => {
    const grant = { ...entry("GRANT", 9_000_000), stripeInvoiceId: "in_1" };
    const scorecard = evaluateBilling({
      billing: catalog(0.01),
      usageRecords: [],
      ledgerEntries: [grant, { ...grant, id: "le_dup" }]
    });
    assert.equal(scorecard.invariants.find((i) => i.id === "BIL-6")?.verdict, "fail");
  });
});
