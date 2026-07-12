import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rateOverridesSchema, ratesSchema } from "./rates.js";
import { billingConfigSchema } from "../config.js";
import { deriveBalanceMicro } from "./ledger.js";

const validRates = {
  sms: { perMessage: 0.008 },
  email: { perMessage: 0.0004 },
  whatsappMessage: { perMessage: 0.01 },
  voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
  voiceAi: { perMinute: 0.4, increments: "15/15" },
  whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
  whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
};

describe("ratesSchema", () => {
  it("accepts a complete seven-meter rate card", () => {
    assert.deepEqual(ratesSchema.parse(validRates), validRates);
  });

  it("rejects a card missing a meter", () => {
    const missingEmail = Object.fromEntries(
      Object.entries(validRates).filter(([meter]) => meter !== "email")
    );
    const result = ratesSchema.safeParse(missingEmail);
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some((issue) => issue.path.includes("email")));
  });

  it("rejects increments on a message meter", () => {
    const result = ratesSchema.safeParse({
      ...validRates,
      sms: { perMessage: 0.008, increments: "15/15" }
    });
    assert.equal(result.success, false);
  });

  it("rejects a voice meter without increments", () => {
    const result = ratesSchema.safeParse({
      ...validRates,
      voiceAi: { perMinute: 0.4 }
    });
    assert.equal(result.success, false);
  });

  it("rejects malformed increment notation", () => {
    const result = ratesSchema.safeParse({
      ...validRates,
      voiceAi: { perMinute: 0.4, increments: "15s" }
    });
    assert.equal(result.success, false);
  });
});

describe("rateOverridesSchema", () => {
  it("accepts a partial card validated with the same meter schemas", () => {
    const parsed = rateOverridesSchema.parse({ voiceAi: { perMinute: 0.3, increments: "60/6" } });
    assert.deepEqual(parsed, { voiceAi: { perMinute: 0.3, increments: "60/6" } });
  });

  it("rejects wrong-kind fields even in a partial card", () => {
    assert.equal(rateOverridesSchema.safeParse({ sms: { perMinute: 0.3 } }).success, false);
  });
});

describe("billingConfigSchema", () => {
  const plan = (key: string) => ({
    key,
    name: { en: "Starter", es: "Inicial" },
    monthlyPrice: 29,
    monthlyAllowance: 29,
    stripePriceId: "price_123",
    rates: validRates
  });

  it("loads a valid catalog preserving plan order as the upgrade path", () => {
    const parsed = billingConfigSchema.parse({
      enabled: true,
      plans: [plan("starter"), plan("growth")]
    });
    assert.ok(parsed);
    assert.deepEqual(
      parsed.plans.map((p) => p.key),
      ["starter", "growth"]
    );
    assert.equal(parsed.currency, "USD");
    assert.equal(parsed.voiceDebitEstimateSeconds, 60);
  });

  it("rejects duplicate plan keys naming the duplicate", () => {
    const result = billingConfigSchema.safeParse({ plans: [plan("starter"), plan("starter")] });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some((issue) => issue.message.includes('"starter"')));
  });

  it("rejects a plan whose rates omit a meter, identifying plan and meter", () => {
    const broken = plan("starter");
    const rates = Object.fromEntries(
      Object.entries(broken.rates).filter(([meter]) => meter !== "whatsappMessage")
    );
    const result = billingConfigSchema.safeParse({ plans: [{ ...broken, rates }] });
    assert.equal(result.success, false);
    const issue = result.error.issues.find((i) => i.path.includes("whatsappMessage"));
    assert.ok(issue, "expected an issue on the missing meter");
    assert.ok(issue.path.includes(0), "expected the path to identify the plan");
  });

  it("is optional and disabled by default", () => {
    assert.equal(billingConfigSchema.parse(undefined), undefined);
    const parsed = billingConfigSchema.parse({ plans: [plan("starter")] });
    assert.equal(parsed?.enabled, false);
  });
});

describe("deriveBalanceMicro", () => {
  it("derives the balance from signed entries exactly", () => {
    const balance = deriveBalanceMicro([
      { amountMicro: 29_000_000 },
      { amountMicro: -12_500_000 },
      { amountMicro: -300_000 }
    ]);
    assert.equal(balance, 16_200_000);
  });
});
