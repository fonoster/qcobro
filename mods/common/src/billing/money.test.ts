import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { microUnitsToDecimalString, sumMicroUnits, toMicroUnits } from "./money.js";

describe("toMicroUnits", () => {
  it("converts decimal amounts exactly, absorbing float representation error", () => {
    assert.equal(toMicroUnits(0.0004), 400);
    assert.equal(toMicroUnits(0.008), 8000);
    assert.equal(toMicroUnits(0.29), 290_000);
    assert.equal(toMicroUnits(29), 29_000_000);
    assert.equal(toMicroUnits(0), 0);
  });

  it("rejects non-finite amounts", () => {
    assert.throws(() => toMicroUnits(Number.NaN), RangeError);
    assert.throws(() => toMicroUnits(Number.POSITIVE_INFINITY), RangeError);
  });
});

describe("sumMicroUnits", () => {
  it("aggregates a thousand sub-cent records with zero drift", () => {
    const records = Array.from({ length: 1000 }, () => toMicroUnits(0.0004));
    assert.equal(sumMicroUnits(records), 400_000);
  });

  it("sums signed entries (grants, debits, adjustments)", () => {
    assert.equal(sumMicroUnits([29_000_000, -12_500_000, -300_000]), 16_200_000);
  });

  it("rejects non-integer operands", () => {
    assert.throws(() => sumMicroUnits([0.5]), RangeError);
  });
});

describe("microUnitsToDecimalString", () => {
  it("renders two-digit display amounts, rounding only here", () => {
    assert.equal(microUnitsToDecimalString(16_200_000), "16.20");
    assert.equal(microUnitsToDecimalString(400_000), "0.40");
    assert.equal(microUnitsToDecimalString(405_000), "0.41");
    assert.equal(microUnitsToDecimalString(404_999), "0.40");
  });

  it("handles negative balances and zero fraction digits", () => {
    assert.equal(microUnitsToDecimalString(-1_250_000), "-1.25");
    assert.equal(microUnitsToDecimalString(-1_250_000, 0), "-1");
    assert.equal(microUnitsToDecimalString(0), "0.00");
  });
});
