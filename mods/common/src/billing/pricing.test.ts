import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  billedSeconds,
  estimateVoiceDebitMicro,
  parseIncrements,
  priceMessageMicro,
  priceVoiceMicro,
  resolveRate
} from "./pricing.js";
import type { Rates } from "./rates.js";

const fifteenFifteen = parseIncrements("15/15");

describe("parseIncrements", () => {
  it("parses standard telecom notation", () => {
    assert.deepEqual(parseIncrements("15/15"), { initialSeconds: 15, subsequentSeconds: 15 });
    assert.deepEqual(parseIncrements("60/6"), { initialSeconds: 60, subsequentSeconds: 6 });
  });

  it("rejects malformed notation", () => {
    assert.throws(() => parseIncrements("15"), RangeError);
    assert.throws(() => parseIncrements("0/15"), RangeError);
    assert.throws(() => parseIncrements("15/0"), RangeError);
    assert.throws(() => parseIncrements("15/15/15"), RangeError);
  });
});

describe("billedSeconds", () => {
  it("matches the canonical 15/15 vectors", () => {
    assert.equal(billedSeconds(1, fifteenFifteen), 15);
    assert.equal(billedSeconds(15, fifteenFifteen), 15);
    assert.equal(billedSeconds(16, fifteenFifteen), 30);
    assert.equal(billedSeconds(35, fifteenFifteen), 45);
  });

  it("bills zero when the call was never answered", () => {
    assert.equal(billedSeconds(0, fifteenFifteen), 0);
    assert.equal(billedSeconds(-1, fifteenFifteen), 0);
  });

  it("supports split increments like 60/6", () => {
    const sixtySix = parseIncrements("60/6");
    assert.equal(billedSeconds(23, sixtySix), 60);
    assert.equal(billedSeconds(60, sixtySix), 60);
    assert.equal(billedSeconds(61, sixtySix), 66);
    assert.equal(billedSeconds(88, sixtySix), 90);
  });
});

describe("priceVoiceMicro", () => {
  const voiceAi = { perMinute: 0.4, increments: "15/15" };

  it("prices 95 answered seconds as 105 billed seconds", () => {
    const price = priceVoiceMicro(95, voiceAi);
    assert.equal(price.billedSeconds, 105);
    assert.equal(price.perMinuteMicro, 400_000);
    assert.equal(price.amountMicro, 700_000); // 105s at 0.40/min = 0.70
  });

  it("prices an unanswered call to zero", () => {
    assert.equal(priceVoiceMicro(0, voiceAi).amountMicro, 0);
  });
});

describe("priceMessageMicro", () => {
  it("prices one message at the per-message rate", () => {
    assert.equal(priceMessageMicro({ perMessage: 0.008 }), 8000);
    assert.equal(priceMessageMicro({ perMessage: 0.0004 }), 400);
  });
});

describe("estimateVoiceDebitMicro", () => {
  const rate = { perMinute: 0.4, increments: "15/15" };

  it("debits the configured estimate", () => {
    assert.equal(estimateVoiceDebitMicro(rate, 60), 400_000);
  });

  it("never debits less than the initial increment", () => {
    assert.equal(estimateVoiceDebitMicro(rate, 1), 100_000); // 15s minimum
  });
});

describe("resolveRate", () => {
  const rates: Rates = {
    sms: { perMessage: 0.008 },
    email: { perMessage: 0.0004 },
    whatsappMessage: { perMessage: 0.01 },
    voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
    voiceAi: { perMinute: 0.4, increments: "15/15" },
    whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
    whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
  };

  it("prefers a workspace override for the overridden meter only", () => {
    const overrides = { voiceAi: { perMinute: 0.3, increments: "60/6" } };
    assert.deepEqual(resolveRate("voiceAi", rates, overrides), {
      perMinute: 0.3,
      increments: "60/6"
    });
    assert.deepEqual(resolveRate("sms", rates, overrides), { perMessage: 0.008 });
  });

  it("falls back to the plan rate without overrides", () => {
    assert.deepEqual(resolveRate("email", rates), { perMessage: 0.0004 });
  });
});
