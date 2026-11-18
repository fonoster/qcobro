import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startOfLocalDay } from "./time.js";

describe("startOfLocalDay", () => {
  it("returns the UTC instant of local midnight in a fixed-offset zone", () => {
    assert.equal(
      startOfLocalDay("2026-11-01", "America/Santo_Domingo").toISOString(),
      "2026-11-01T04:00:00.000Z"
    );
  });

  it("follows daylight saving time", () => {
    assert.equal(
      startOfLocalDay("2026-07-01", "America/New_York").toISOString(),
      "2026-07-01T04:00:00.000Z"
    );
    assert.equal(
      startOfLocalDay("2026-12-01", "America/New_York").toISOString(),
      "2026-12-01T05:00:00.000Z"
    );
  });

  it("handles zones ahead of UTC", () => {
    assert.equal(
      startOfLocalDay("2026-11-01", "Europe/Madrid").toISOString(),
      "2026-10-31T23:00:00.000Z"
    );
  });
});
