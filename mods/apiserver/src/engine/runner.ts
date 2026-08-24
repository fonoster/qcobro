import type { PrismaClient } from "@prisma/client";
import type { EngineEventSink, TickReport } from "@qcobro/common";
import { getLogger } from "@fonoster/logger";

const logger = getLogger({ service: "engine", filePath: import.meta.url });

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
  logger.verbose(
    `tick ${report.at}: ${report.campaigns.length} campaign(s), ${dispatched} dispatched`
  );
}

/** Thrown by the watchdog race in place of whatever the hung operation would have thrown. */
class TickWatchdogError extends Error {
  constructor(maxTickMs: number) {
    super(`tick did not complete within ${maxTickMs}ms`);
    this.name = "TickWatchdogError";
  }
}

/**
 * Drives the engine tick on a timer. Single-flight (a new tick is skipped while one is
 * running) and guarded by a Postgres advisory lock so only one instance dispatches.
 * Shutdown stops scheduling and waits for the in-flight tick to settle — a reserved-but-
 * undispatched attempt is at-most-once-safe (it is counted, never re-dialed). A watchdog
 * bounds how long a single tick may run (see `maxTickMs` below) so a hung tick cannot
 * permanently block every future one.
 */
export function createEngineRunner(opts: {
  prisma: PrismaClient;
  tick: () => Promise<TickReport>;
  tickSeconds: number;
  log?: (report: TickReport) => void;
  /** Flight-recorder sink; tick events are flushed to it best-effort after each tick. */
  eventSink?: EngineEventSink | null;
  /** Expired-event pruner (see `createEventPruner`); invoked at most hourly. */
  pruneEvents?: (() => Promise<number>) | null;
  /**
   * Watchdog bound (ms) — see `config.engine.maxTickMs`. A tick (lock acquire through
   * dispatch) that hangs past this releases the in-process single-flight guard so the next
   * scheduled tick can attempt again, rather than blocking every future tick forever. The
   * hung operation itself is not cancelled (JS cannot cancel an in-flight promise) — it may
   * still settle later in the background, harmlessly, since the Postgres advisory lock
   * (not this in-process flag) is what actually prevents two ticks from dispatching at once.
   * Defaults to `config.engine.maxTickMs`'s own default when omitted.
   */
  maxTickMs?: number;
}): EngineRunner {
  const maxTickMs = opts.maxTickMs ?? 180_000;
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let lastPruneMs = 0;

  async function runTick(): Promise<void> {
    const rows = await opts.prisma.$queryRaw<
      { locked: boolean }[]
    >`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`;
    if (!rows[0]?.locked) return; // another instance holds the lock
    try {
      const report = await opts.tick();
      (opts.log ?? defaultLog)(report);
      // Best-effort telemetry: a sink failure must never fail the tick.
      if (opts.eventSink && report.events && report.events.length > 0) {
        try {
          await opts.eventSink.record(report.events);
        } catch (err) {
          logger.error("event flush failed", err);
        }
      }
      if (opts.pruneEvents && Date.now() - lastPruneMs > 3_600_000) {
        lastPruneMs = Date.now();
        try {
          await opts.pruneEvents();
        } catch (err) {
          logger.error("event pruning failed", err);
        }
      }
    } finally {
      await opts.prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
    }
  }

  async function runOnce(): Promise<void> {
    if (running) return; // single-flight: never overlap ticks
    running = true;
    let watchdog: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        runTick(),
        new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => reject(new TickWatchdogError(maxTickMs)), maxTickMs);
        })
      ]);
    } catch (err) {
      if (err instanceof TickWatchdogError) {
        logger.error(
          `tick watchdog fired — a tick has not completed in ${maxTickMs}ms, likely a ` +
            `hung DB or provider call; releasing the in-process lock so the next scheduled ` +
            `tick can attempt again`
        );
      } else {
        logger.error("tick failed", err);
      }
    } finally {
      if (watchdog) clearTimeout(watchdog);
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
