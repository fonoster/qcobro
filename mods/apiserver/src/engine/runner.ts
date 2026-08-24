import type { PrismaClient } from "@prisma/client";
import type { EngineEventSink, TickReport } from "@qcobro/common";
import { getLogger } from "@fonoster/logger";
import { TimeoutError, withTimeout } from "../utils/withTimeout.js";

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

/**
 * Drives the engine tick on a timer. Single-flight (a new tick is skipped while one is
 * running) and guarded by a Postgres advisory lock so only one instance dispatches.
 * Shutdown stops scheduling and waits for every real tick to actually settle — a reserved-
 * but-undispatched attempt is at-most-once-safe (it is counted, never re-dialed) — including
 * one the watchdog below has already given up waiting on, so a watchdog trip can never cause
 * a mid-dispatch tick to be killed by a subsequent process shutdown.
 *
 * A watchdog bounds how long a single tick may run (see `maxTickMs` below): past that bound,
 * the in-process single-flight gate releases so the *next scheduled* tick can attempt again,
 * without waiting for the hung one. This is safe because the gate is only a scheduling
 * convenience — the Postgres advisory lock, not this in-process state, is what actually
 * prevents two ticks from dispatching at once; a new attempt made while the old one is still
 * technically pending just observes the lock is held and cleanly no-ops. The hung operation
 * itself is never cancelled (not possible for an in-flight promise) and is still tracked to
 * completion for `stop()`'s sake, whenever it does settle.
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
  // Gates whether a *new* runOnce attempt starts — released by the watchdog on a hang, so it
  // does not track whether the real tick has actually finished (see `pendingRealTicks`).
  let singleFlightBusy = false;
  // How many real `runTick()` calls have not yet settled, watchdog or not — what `stop()`
  // actually waits on, so a watchdog-released tick can never be killed mid-dispatch by a
  // subsequent shutdown.
  let pendingRealTicks = 0;
  // When the current single-flight-busy period started — lets a skip log report how long a
  // tick has already been stuck, without waiting for the watchdog to fire (up to `maxTickMs`
  // later) to find out. Every scheduled tick a hang eats is a real, un-recoverable-that-day
  // loss of dispatch throughput (each tick's per-channel budget is only available that tick —
  // see `perTickCapacity`), so this must be visible well before the watchdog bound.
  let busySince: number | null = null;
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
    if (singleFlightBusy) {
      // A scheduled tick's whole per-channel budget for this cycle is lost when skipped —
      // log it every time, not just once, so "how long has this been stuck" is visible from
      // the logs alone well before the watchdog bound.
      const busyForMs = busySince ? Date.now() - busySince : undefined;
      logger.warn(
        `scheduled tick skipped — a previous tick is still in flight` +
          (busyForMs !== undefined ? ` (busy for ${busyForMs}ms so far)` : "")
      );
      return; // single-flight: never overlap NEW tick attempts
    }
    singleFlightBusy = true;
    busySince = Date.now();
    pendingRealTicks += 1;
    // Errors are handled here, at the source, so `real` always resolves — the only way the
    // race below can reject is the watchdog's own timeout, never a real tick failure. This
    // also guarantees a failure that surfaces only after the watchdog gave up is still logged
    // exactly once, rather than becoming an unhandled rejection.
    const real = runTick()
      .then(
        () => undefined,
        (err: unknown) => logger.error("tick failed", err)
      )
      .finally(() => {
        pendingRealTicks -= 1;
      });

    try {
      await withTimeout(real, maxTickMs, `tick did not complete within ${maxTickMs}ms`);
    } catch (err) {
      if (err instanceof TimeoutError) {
        logger.error(
          `tick watchdog fired — a tick has not completed in ${maxTickMs}ms, likely a ` +
            `hung DB or provider call; releasing the in-process lock so the next scheduled ` +
            `tick can attempt again (the hung tick is still tracked to completion for shutdown)`
        );
      }
    } finally {
      singleFlightBusy = false;
      busySince = null;
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
      while (pendingRealTicks > 0) await new Promise((r) => setTimeout(r, 50));
    }
  };
}
