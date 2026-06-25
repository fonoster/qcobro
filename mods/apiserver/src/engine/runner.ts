import type { PrismaClient } from "@prisma/client";
import type { TickReport } from "@qcobro/common";

// Arbitrary app-wide key for the engine's Postgres advisory lock. Ensures that even
// if more than one apiserver instance runs, only one ticks at a time.
const ADVISORY_LOCK_KEY = 4242_0001;

export interface EngineRunner {
  start(): void;
  stop(): Promise<void>;
  /** Run a single tick now (used by start-up and tests). */
  runOnce(): Promise<void>;
}

function defaultLog(report: TickReport): void {
  const dispatched = report.campaigns.reduce((n, c) => n + c.dispatched, 0);
  console.log(
    `[engine] tick ${report.at}: ${report.campaigns.length} campaign(s), ${dispatched} dispatched`
  );
}

/**
 * Drives the engine tick on a timer. Single-flight (a new tick is skipped while one is
 * running) and guarded by a Postgres advisory lock so only one instance dispatches.
 * Shutdown stops scheduling and waits for the in-flight tick to settle — a reserved-but-
 * undispatched attempt is at-most-once-safe (it is counted, never re-dialed).
 */
export function createEngineRunner(opts: {
  prisma: PrismaClient;
  tick: () => Promise<TickReport>;
  tickSeconds: number;
  log?: (report: TickReport) => void;
}): EngineRunner {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  async function runOnce(): Promise<void> {
    if (running) return; // single-flight: never overlap ticks
    running = true;
    try {
      const rows = await opts.prisma.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`;
      if (!rows[0]?.locked) return; // another instance holds the lock
      try {
        const report = await opts.tick();
        (opts.log ?? defaultLog)(report);
      } finally {
        await opts.prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
      }
    } catch (err) {
      console.error("[engine] tick failed", err);
    } finally {
      running = false;
    }
  }

  return {
    runOnce,
    start() {
      if (timer) return;
      timer = setInterval(() => void runOnce(), opts.tickSeconds * 1000);
    },
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      while (running) await new Promise((r) => setTimeout(r, 50));
    }
  };
}
