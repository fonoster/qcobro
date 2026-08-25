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

  it("keeps renewing until an in-flight tick finishes, then releases", async () => {
    // stop() must not stop the heartbeat before the tick settles: letting the lease lapse
    // mid-dispatch reopens the concurrent-dispatch window the heartbeat exists to close.
    const events: string[] = [];
    let releaseTick: (() => void) | undefined;
    const tickDone = new Promise<void>((resolve) => (releaseTick = resolve));
    const runner = createEngineRunner({
      prisma: makePrisma(),
      tickSeconds: 60,
      leaseTtlSeconds: 30,
      tick: async () => {
        events.push("tick-start");
        await tickDone;
        events.push("tick-end");
        return emptyReport;
      },
      lease: {
        holder: "self",
        acquire: async () => true,
        release: async () => {
          events.push("release");
        }
      }
    });

    runner.start();
    const inFlight = runner.runOnce();
    await new Promise((r) => setTimeout(r, 10));
    const stopping = runner.stop();
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(!events.includes("release"), "release must not happen while the tick is running");
    releaseTick!();
    await inFlight;
    await stopping;

    assert.deepEqual(events, ["tick-start", "tick-end", "release"]);
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
