import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngineRunner } from "./runner.js";

function makePrisma() {
  return {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("pg_try_advisory_lock")) return [{ locked: true }];
      return [];
    }
  } as never;
}

const emptyReport = { at: new Date().toISOString(), campaigns: [], events: [] } as never;

describe("createEngineRunner — voice completion timeout sweep gating", () => {
  it("invokes sweepVoiceDispatches on the first tick", async () => {
    let calls = 0;
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => emptyReport,
      tickSeconds: 60,
      sweepVoiceDispatches: async () => {
        calls++;
        return 0;
      },
      sweepVoiceDispatchesIntervalMs: 100_000
    });

    await runner.runOnce();

    assert.equal(calls, 1);
  });

  it("does not invoke sweepVoiceDispatches again within the interval", async () => {
    let calls = 0;
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => emptyReport,
      tickSeconds: 60,
      sweepVoiceDispatches: async () => {
        calls++;
        return 0;
      },
      sweepVoiceDispatchesIntervalMs: 100_000
    });

    await runner.runOnce();
    await runner.runOnce();
    await runner.runOnce();

    assert.equal(calls, 1);
  });

  it("a sweep failure is caught and logged, never crashes the tick", async () => {
    let tickRan = false;
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => {
        tickRan = true;
        return emptyReport;
      },
      tickSeconds: 60,
      sweepVoiceDispatches: async () => {
        throw new Error("sweep exploded");
      },
      sweepVoiceDispatchesIntervalMs: 100_000
    });

    await assert.doesNotReject(() => runner.runOnce());
    assert.equal(tickRan, true);
  });

  it("is skipped entirely when sweepVoiceDispatches is absent", async () => {
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => emptyReport,
      tickSeconds: 60
    });

    await assert.doesNotReject(() => runner.runOnce());
  });
});
