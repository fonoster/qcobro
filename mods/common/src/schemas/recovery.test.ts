import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyExitsInputSchema,
  listExitsInputSchema,
  recoveryBreakdownInputSchema,
  recoveryListInputSchema,
  recoverySummaryInputSchema
} from "./recovery.js";

const messages = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => result.error!.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

describe("recovery period schemas", () => {
  it("accepts an inclusive YYYY-MM-DD period", () => {
    assert.equal(
      recoverySummaryInputSchema.safeParse({ from: "2026-10-01", to: "2026-10-31" }).success,
      true
    );
    assert.equal(
      recoverySummaryInputSchema.safeParse({ from: "2026-10-31", to: "2026-10-31" }).success,
      true
    );
  });

  it("rejects an invalid date with the documented message", () => {
    const result = recoverySummaryInputSchema.safeParse({ from: "2026-13-01", to: "2026-10-31" });
    assert.deepEqual(messages(result), [
      { path: "from", message: 'invalid date "2026-13-01" (use YYYY-MM-DD)' }
    ]);
    assert.equal(
      recoverySummaryInputSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success,
      false
    );
    assert.equal(
      recoverySummaryInputSchema.safeParse({ from: "01/10/2026", to: "2026-10-31" }).success,
      false
    );
  });

  it("rejects from after to", () => {
    const result = recoverySummaryInputSchema.safeParse({ from: "2026-11-01", to: "2026-10-31" });
    assert.deepEqual(messages(result), [{ path: "from", message: "from must be on or before to" }]);
  });

  it("requires a known breakdown dimension", () => {
    const period = { from: "2026-10-01", to: "2026-10-31" };
    assert.equal(
      recoveryBreakdownInputSchema.safeParse({ ...period, by: "CHANNEL" }).success,
      true
    );
    assert.equal(recoveryBreakdownInputSchema.safeParse({ ...period, by: "DAYS" }).success, false);
  });

  it("defaults list paging to 50 from 0 and caps it at 200", () => {
    const period = { from: "2026-10-01", to: "2026-10-31" };
    const parsed = recoveryListInputSchema.parse(period);
    assert.equal(parsed.limit, 50);
    assert.equal(parsed.offset, 0);
    assert.equal(recoveryListInputSchema.safeParse({ ...period, limit: 201 }).success, false);
    assert.equal(listExitsInputSchema.parse({ portfolioId: "p1" }).limit, 50);
  });
});

describe("classifyExitsInputSchema", () => {
  it("accepts CURED with the recovery fields and WRITTEN_OFF without them", () => {
    const result = classifyExitsInputSchema.safeParse({
      portfolioId: "p1",
      exits: [
        { externalId: "C-0877", reason: "CURED", missedInstallments: 2, termsAmount: 1500 },
        { externalId: "C-0878", reason: "WRITTEN_OFF" }
      ]
    });
    assert.equal(result.success, true);
  });

  it("uses the sync's messages for a missing field and a duplicate id", () => {
    const result = classifyExitsInputSchema.safeParse({
      portfolioId: "p1",
      exits: [
        { externalId: "C-0877", reason: "CURED", missedInstallments: 2 },
        { externalId: "C-0877", reason: "OTHER" }
      ]
    });
    assert.deepEqual(messages(result), [
      { path: "exits.0.termsAmount", message: "required when reason is CURED or PAID_OFF" },
      { path: "exits.1.externalId", message: 'externalId "C-0877" appears twice in exits' }
    ]);
  });

  it("needs at least one exit", () => {
    assert.equal(
      classifyExitsInputSchema.safeParse({ portfolioId: "p1", exits: [] }).success,
      false
    );
  });
});
