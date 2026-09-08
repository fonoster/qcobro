import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyVoiceError, parseEndedAt } from "./fonosterOutboundCallClient.js";

describe("classifyVoiceError", () => {
  it("classifies INVALID_ARGUMENT (invalid destination) as DELIVERY_REJECTED", () => {
    const err = classifyVoiceError({ code: 3, message: "invalid 'to' number" });
    assert.equal(err.kind, "DELIVERY_REJECTED");
  });

  it("classifies FAILED_PRECONDITION (carrier rejected) as DELIVERY_REJECTED", () => {
    const err = classifyVoiceError({ code: 9, message: "carrier declined the call" });
    assert.equal(err.kind, "DELIVERY_REJECTED");
  });

  it("classifies UNAUTHENTICATED as SYSTEM_ERROR", () => {
    const err = classifyVoiceError({ code: 16, message: "invalid api key/secret" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("classifies UNAVAILABLE as SYSTEM_ERROR", () => {
    const err = classifyVoiceError({ code: 14, message: "fonoster unavailable" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("falls back to SYSTEM_ERROR for an unclassifiable error (e.g. a timeout)", () => {
    const err = classifyVoiceError(new Error("Fonoster createCall timed out"));
    assert.equal(err.kind, "SYSTEM_ERROR");
  });
});

/**
 * `@fonoster/types` declares `CallDetailRecord.endedAt` as a `Date`, but the wire proto field
 * is `int32 ended_at = 6` — an epoch-seconds integer nothing in Fonoster's SDK converts. These
 * cover every shape the raw value could plausibly arrive as, so the fix holds whichever the
 * runtime truth turns out to be, not just the one the declared type claims.
 */
describe("parseEndedAt", () => {
  it("accepts a Date", () => {
    const date = new Date("2026-08-24T12:00:00.000Z");
    assert.deepEqual(parseEndedAt(date), date);
  });

  it("accepts epoch seconds as a number, scaling up to milliseconds", () => {
    const seconds = 1_787_824_800; // 2026-08-24T12:00:00.000Z, well under the magnitude cutoff
    assert.deepEqual(parseEndedAt(seconds), new Date(seconds * 1000));
  });

  it("accepts epoch milliseconds as a number, left as-is", () => {
    const ms = 1_787_824_800_000; // same instant, already in milliseconds
    assert.deepEqual(parseEndedAt(ms), new Date(ms));
  });

  it("accepts a numeric string (epoch seconds)", () => {
    const seconds = 1_787_824_800;
    assert.deepEqual(parseEndedAt(String(seconds)), new Date(seconds * 1000));
  });

  it("rejects 0 — the protobuf zero-value for a call that hasn't cleared", () => {
    assert.equal(parseEndedAt(0), null);
  });

  it("rejects a non-numeric string", () => {
    assert.equal(parseEndedAt("not-a-date"), null);
  });

  it("rejects undefined/null/negative/NaN", () => {
    assert.equal(parseEndedAt(undefined), null);
    assert.equal(parseEndedAt(null), null);
    assert.equal(parseEndedAt(-1), null);
    assert.equal(parseEndedAt(Number.NaN), null);
  });
});
