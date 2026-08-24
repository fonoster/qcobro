import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TickReport } from "@qcobro/common";
import { createEngineRunner } from "./runner.js";

/** A minimal `$queryRaw` stub: the advisory lock always succeeds, the unlock is a no-op. */
function fakePrisma() {
  return {
    $queryRaw: async () => [{ locked: true }]
  } as never;
}

const REPORT: TickReport = { at: new Date().toISOString(), campaigns: [], channelUsage: {} };

describe("createEngineRunner watchdog", () => {
  it("a normal tick completes without the watchdog firing", async () => {
    let logged: TickReport | undefined;
    const runner = createEngineRunner({
      prisma: fakePrisma(),
      tick: async () => REPORT,
      tickSeconds: 60,
      log: (r) => {
        logged = r;
      },
      maxTickMs: 200
    });

    await runner.runOnce();
    assert.equal(logged, REPORT);
  });

  it("a tick that never resolves is released by the watchdog instead of hanging forever", async () => {
    const runner = createEngineRunner({
      prisma: fakePrisma(),
      tick: () => new Promise<TickReport>(() => {}), // never settles
      tickSeconds: 60,
      log: () => undefined,
      maxTickMs: 50
    });

    const start = Date.now();
    await runner.runOnce(); // must not hang forever
    assert.ok(Date.now() - start < 1000, "runOnce resolved promptly once the watchdog fired");
  });

  it("after a watchdog trip, the single-flight guard resets so the next call can proceed", async () => {
    let attempts = 0;
    const runner = createEngineRunner({
      prisma: fakePrisma(),
      tick: async () => {
        attempts += 1;
        if (attempts === 1) return new Promise<TickReport>(() => {}); // first hangs forever
        return REPORT; // second succeeds
      },
      tickSeconds: 60,
      log: () => undefined,
      maxTickMs: 50
    });

    await runner.runOnce(); // watchdog releases the hung first attempt
    await runner.runOnce(); // must be able to run again, not report "still running"
    assert.equal(attempts, 2);
  });

  it("single-flight: a concurrent runOnce call while one is in-flight is a no-op", async () => {
    let attempts = 0;
    const runner = createEngineRunner({
      prisma: fakePrisma(),
      tick: async () => {
        attempts += 1;
        await new Promise((r) => setTimeout(r, 30));
        return REPORT;
      },
      tickSeconds: 60,
      log: () => undefined,
      maxTickMs: 5000
    });

    await Promise.all([runner.runOnce(), runner.runOnce()]);
    assert.equal(attempts, 1, "the overlapping call never attempted a second tick");
  });
});
