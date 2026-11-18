import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recoveryPeriodRange } from "./recoveryPeriod.js";

const TZ = "America/Santo_Domingo";
const at = (iso: string) => new Date(iso);

describe("recoveryPeriodRange", () => {
  it("reads this month from the 1st through today", () => {
    assert.deepEqual(recoveryPeriodRange("thisMonth", TZ, at("2026-11-17T12:00:00Z")), {
      from: "2026-11-01",
      to: "2026-11-17"
    });
  });

  it("reads last month as the whole previous month, across a year boundary", () => {
    assert.deepEqual(recoveryPeriodRange("lastMonth", TZ, at("2026-01-15T12:00:00Z")), {
      from: "2025-12-01",
      to: "2025-12-31"
    });
    assert.deepEqual(recoveryPeriodRange("lastMonth", TZ, at("2024-03-05T12:00:00Z")), {
      from: "2024-02-01",
      to: "2024-02-29"
    });
  });

  it("reads this year from January 1st through today", () => {
    assert.deepEqual(recoveryPeriodRange("thisYear", TZ, at("2026-11-17T12:00:00Z")), {
      from: "2026-01-01",
      to: "2026-11-17"
    });
  });

  it("takes today from the workspace's timezone, not UTC", () => {
    // 03:00 UTC on December 1st is still November 30th in Santo Domingo (UTC-4).
    assert.deepEqual(recoveryPeriodRange("thisMonth", TZ, at("2026-12-01T03:00:00Z")), {
      from: "2026-11-01",
      to: "2026-11-30"
    });
  });
});
