import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngineRunner } from "./runner.js";

function makePrisma() {
  return {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      // A lease claim returns a row when this instance may tick (see lease.ts). These tests
      // cover the sweep/prune gating, so the lease is always granted here.
      if (sql.includes("engine_lease") && sql.includes("INSERT")) return [{ holder: "test" }];
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

describe("createEngineRunner — engine lease gating", () => {
  it("does not tick when the lease is held by another instance", async () => {
    let ticks = 0;
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => {
        ticks++;
        return emptyReport;
      },
      tickSeconds: 60,
      lease: { holder: "self", acquire: async () => false, release: async () => undefined }
    });

    await runner.runOnce();

    assert.equal(ticks, 0, "a peer holds the lease, so this instance stays quiet");
  });

  it("ticks on every run while it holds the lease — no silent skipping", async () => {
    // Guards the regression this replaced: the advisory lock made ticks depend on which
    // pooled connection the query landed on, so most runs silently did nothing.
    let ticks = 0;
    let acquisitions = 0;
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => {
        ticks++;
        return emptyReport;
      },
      tickSeconds: 60,
      lease: {
        holder: "self",
        acquire: async () => {
          acquisitions++;
          return true;
        },
        release: async () => undefined
      }
    });

    for (let i = 0; i < 5; i++) await runner.runOnce();

    assert.equal(ticks, 5);
    assert.equal(acquisitions, 5, "the lease is renewed each tick, not held open");
  });

  it("releases the lease on stop so a redeploy fails over without waiting out the TTL", async () => {
    let released = 0;
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => emptyReport,
      tickSeconds: 60,
      lease: {
        holder: "self",
        acquire: async () => true,
        release: async () => {
          released++;
        }
      }
    });

    await runner.runOnce();
    await runner.stop();

    assert.equal(released, 1);
  });

  it("a failing lease release never fails shutdown", async () => {
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tick: async () => emptyReport,
      tickSeconds: 60,
      lease: {
        holder: "self",
        acquire: async () => true,
        release: async () => {
          throw new Error("db gone");
        }
      }
    });

    await runner.runOnce();
    await assert.doesNotReject(() => runner.stop());
  });
});
