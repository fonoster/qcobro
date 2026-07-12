import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildThresholdOverrides,
  CliError,
  DEFAULT_URL,
  parseCliArgs,
  resolveCredentials,
  resolveRange
} from "./engineEval.js";

describe("parseCliArgs", () => {
  it("defaults url and booleans, leaves range/creds undefined", () => {
    const opts = parseCliArgs([]);
    assert.equal(opts.url, DEFAULT_URL);
    assert.equal(opts.from, undefined);
    assert.equal(opts.to, undefined);
    assert.equal(opts.accessKeyId, undefined);
    assert.equal(opts.accessKeySecret, undefined);
    assert.equal(opts.json, false);
    assert.equal(opts.help, false);
  });

  it("parses every flag", () => {
    const opts = parseCliArgs([
      "--url",
      "https://staging.example.com",
      "--from",
      "2026-07-01T00:00:00.000Z",
      "--to",
      "2026-07-02T00:00:00.000Z",
      "--access-key-id",
      "AK123",
      "--access-key-secret",
      "s3cr3t",
      "--latency-p95",
      "1500",
      "--max-error-rate",
      "0.1",
      "--liveness-ticks",
      "5",
      "--json"
    ]);
    assert.equal(opts.url, "https://staging.example.com");
    assert.equal(opts.from, "2026-07-01T00:00:00.000Z");
    assert.equal(opts.to, "2026-07-02T00:00:00.000Z");
    assert.equal(opts.accessKeyId, "AK123");
    assert.equal(opts.accessKeySecret, "s3cr3t");
    assert.equal(opts.latencyP95, 1500);
    assert.equal(opts.maxErrorRate, 0.1);
    assert.equal(opts.livenessTicks, 5);
    assert.equal(opts.json, true);
  });

  it("recognizes --help", () => {
    assert.equal(parseCliArgs(["--help"]).help, true);
  });

  it("throws CliError on a non-numeric threshold flag", () => {
    assert.throws(() => parseCliArgs(["--latency-p95", "not-a-number"]), CliError);
  });

  it("throws CliError on an unknown flag", () => {
    assert.throws(() => parseCliArgs(["--bogus"]), CliError);
  });
});

describe("resolveRange", () => {
  it("defaults to local midnight..now when both are omitted", () => {
    const now = new Date(2026, 6, 11, 15, 30, 0); // local: 2026-07-11 15:30
    const range = resolveRange(undefined, undefined, now);
    const expectedMidnight = new Date(2026, 6, 11, 0, 0, 0, 0);
    assert.equal(range.from, expectedMidnight.toISOString());
    assert.equal(range.to, now.toISOString());
  });

  it("passes explicit values through unchanged", () => {
    const now = new Date(2026, 6, 11, 15, 30, 0);
    const range = resolveRange("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z", now);
    assert.deepEqual(range, {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z"
    });
  });

  it("does not default the other side when only one flag is given", () => {
    const now = new Date(2026, 6, 11, 15, 30, 0);
    const range = resolveRange("2026-01-01T00:00:00.000Z", undefined, now);
    assert.equal(range.from, "2026-01-01T00:00:00.000Z");
    assert.equal(range.to, undefined);
  });
});

describe("resolveCredentials", () => {
  it("prefers flags over env vars", () => {
    const creds = resolveCredentials(
      { accessKeyId: "flag-id", accessKeySecret: "flag-secret" },
      { QCOBRO_ACCESS_KEY_ID: "env-id", QCOBRO_ACCESS_KEY_SECRET: "env-secret" }
    );
    assert.deepEqual(creds, { accessKeyId: "flag-id", accessKeySecret: "flag-secret" });
  });

  it("falls back to env vars when flags are absent", () => {
    const creds = resolveCredentials(
      {},
      { QCOBRO_ACCESS_KEY_ID: "env-id", QCOBRO_ACCESS_KEY_SECRET: "env-secret" }
    );
    assert.deepEqual(creds, { accessKeyId: "env-id", accessKeySecret: "env-secret" });
  });

  it("throws CliError with a clear message when both are missing", () => {
    assert.throws(
      () => resolveCredentials({}, {}),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        assert.match((err as Error).message, /QCOBRO_ACCESS_KEY_ID/);
        return true;
      }
    );
  });
});

describe("buildThresholdOverrides", () => {
  it("is empty when no threshold flags are provided", () => {
    assert.deepEqual(buildThresholdOverrides({}), {});
  });

  it("includes only the flags actually passed", () => {
    assert.deepEqual(buildThresholdOverrides({ latencyP95: 3000 }), {
      dispatchLatencyP95Ms: 3000
    });
    assert.deepEqual(buildThresholdOverrides({ maxErrorRate: 0.05, livenessTicks: 8 }), {
      maxErrorRate: 0.05,
      livenessTicks: 8
    });
  });
});
