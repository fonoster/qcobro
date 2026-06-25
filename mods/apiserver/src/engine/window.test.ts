import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isInWindow, isPastEndDate, type WindowCampaign } from "./window.js";

// America/Costa_Rica is UTC-6 year-round (no DST) — deterministic for tests.
const TZ = "America/Costa_Rica";

const BASE: WindowCampaign = {
  status: "ACTIVE",
  startDate: new Date("2026-06-01T00:00:00Z"),
  endDate: new Date("2026-12-31T00:00:00Z"),
  daysOfWeek: [1, 2, 3, 4, 5], // Mon–Fri
  startTime: "08:00",
  endTime: "18:00"
};

// 2026-06-23 is a Tuesday. 15:00Z = 09:00 local (in window).
const TUE_0900 = new Date("2026-06-23T15:00:00Z");

describe("isInWindow", () => {
  it("is in window on a weekday within the time range", () => {
    assert.deepEqual(isInWindow(BASE, TUE_0900, TZ), { ok: true });
  });

  it("rejects a non-ACTIVE campaign with not_active", () => {
    assert.deepEqual(isInWindow({ ...BASE, status: "PAUSED" }, TUE_0900, TZ), {
      ok: false,
      reason: "not_active"
    });
  });

  it("rejects before the start date", () => {
    const c = { ...BASE, startDate: new Date("2026-07-01T00:00:00Z") };
    assert.deepEqual(isInWindow(c, TUE_0900, TZ), { ok: false, reason: "out_of_window" });
  });

  it("rejects after the end date", () => {
    const c = { ...BASE, endDate: new Date("2026-06-22T00:00:00Z") };
    assert.deepEqual(isInWindow(c, TUE_0900, TZ), { ok: false, reason: "out_of_window" });
  });

  it("rejects a wrong weekday", () => {
    // 2026-06-21 is a Sunday (ISO 7), not in Mon–Fri.
    const sun = new Date("2026-06-21T15:00:00Z");
    assert.deepEqual(isInWindow(BASE, sun, TZ), { ok: false, reason: "out_of_window" });
  });

  it("rejects before startTime (local)", () => {
    // 13:30Z = 07:30 local, before 08:00.
    const early = new Date("2026-06-23T13:30:00Z");
    assert.deepEqual(isInWindow(BASE, early, TZ), { ok: false, reason: "out_of_window" });
  });

  it("rejects after endTime (local)", () => {
    // 2026-06-24T01:00Z = 2026-06-23 19:00 local, after 18:00.
    const late = new Date("2026-06-24T01:00:00Z");
    assert.deepEqual(isInWindow(BASE, late, TZ), { ok: false, reason: "out_of_window" });
  });
});

describe("isPastEndDate", () => {
  it("is false before and on the end date, true after", () => {
    assert.equal(isPastEndDate(BASE, TUE_0900, TZ), false);
    assert.equal(isPastEndDate({ endDate: new Date("2026-06-22T00:00:00Z") }, TUE_0900, TZ), true);
    assert.equal(isPastEndDate({ endDate: null }, TUE_0900, TZ), false);
  });
});
