import type { PrismaClient } from "@prisma/client";
import type { EngineEventSink, TickReport } from "@qcobro/common";
import { getLogger } from "@fonoster/logger";
import { createEngineLease, type EngineLease } from "./lease.js";

const logger = getLogger({ service: "engine", filePath: import.meta.url });

/**
 * Lease TTL when the deployment doesn't set one. Kept short so an ungracefully-killed
 * instance is failed over quickly; it does not have to cover a long tick, because a
 * heartbeat renews the lease independently of tick progress (see `start()`).
 */
function defaultLeaseTtlSeconds(tickSeconds: number): number {
  return Math.max(120, tickSeconds * 2);
}

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
 * running) and guarded by a lease row so only one instance dispatches (see `lease.ts` for
 * why this is not a Postgres advisory lock). Shutdown stops scheduling, waits for the
 * in-flight tick to settle, and releases the lease — a reserved-but-undispatched attempt is
 * at-most-once-safe (it is counted, never re-dialed).
 */
export function createEngineRunner(opts: {
  prisma: PrismaClient;
  tick: () => Promise<TickReport>;
  tickSeconds: number;
  /**
   * How long a lease claim stays valid without renewal — i.e. how long an ungracefully
   * killed instance blocks its peers. It does not have to cover a long tick: the holder
   * renews on a heartbeat independent of tick progress. Defaults to two tick intervals
   * (minimum 120s).
   */
  leaseTtlSeconds?: number;
  /** Overridable for tests; defaults to a lease backed by `prisma`. */
  lease?: EngineLease;
  log?: (report: TickReport) => void;
  /** Flight-recorder sink; tick events are flushed to it best-effort after each tick. */
  eventSink?: EngineEventSink | null;
  /** Expired-event pruner (see `createEventPruner`); invoked at most hourly. */
  pruneEvents?: (() => Promise<number>) | null;
  /**
   * Stale-voice-dispatch timeout sweep (see `createVoiceCompletionTimeoutSweep`); invoked
   * at most every `sweepVoiceDispatchesIntervalMs`, piggybacked on the tick like `pruneEvents`.
   */
  sweepVoiceDispatches?: (() => Promise<number>) | null;
  /** Default 2 minutes — the sweep's own threshold is itself only minutes long. */
  sweepVoiceDispatchesIntervalMs?: number;
}): EngineRunner {
  let timer: NodeJS.Timeout | null = null;
  let renewTimer: NodeJS.Timeout | null = null;
  let running = false;
  let lastPruneMs = 0;
  let lastVoiceSweepMs = 0;
  let busySince = 0;
  const voiceSweepIntervalMs = opts.sweepVoiceDispatchesIntervalMs ?? 120_000;
  const leaseTtlSeconds = opts.leaseTtlSeconds ?? defaultLeaseTtlSeconds(opts.tickSeconds);
  const lease = opts.lease ?? createEngineLease(opts.prisma, { ttlSeconds: leaseTtlSeconds });

  async function runOnce(): Promise<void> {
    if (running) {
      // Never silent: a skipped tick is dispatch capacity that day cannot get back, so it
      // has to be visible within one interval rather than inferred from a gap afterwards.
      logger.warn(
        `scheduled tick skipped — a previous tick is still in flight (busy for ${Date.now() - busySince}ms)`
      );
      return;
    }
    running = true;
    busySince = Date.now();
    try {
      if (!(await lease.acquire())) {
        logger.warn(
          `scheduled tick skipped — the engine lease is held by another instance (this one is ${lease.holder})`
        );
        return;
      }
      // The lease is deliberately NOT released here: this instance renews it on the next
      // tick, so peers stay quiet while it is healthy. Release happens on `stop()`.
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
      if (opts.sweepVoiceDispatches && Date.now() - lastVoiceSweepMs > voiceSweepIntervalMs) {
        lastVoiceSweepMs = Date.now();
        try {
          const n = await opts.sweepVoiceDispatches();
          if (n > 0) logger.verbose(`voice completion timeout sweep: finalized ${n} gestión(es)`);
        } catch (err) {
          logger.error("voice completion timeout sweep failed", err);
        }
      }
    } catch (err) {
      logger.error("tick failed", err);
    } finally {
      running = false;
    }
  }

  return {
    runOnce,
    start() {
      if (timer) return;
      timer = setInterval(() => void runOnce(), opts.tickSeconds * 1000);
      // Renew on its own cadence rather than from the tick, so the TTL bounds failover
      // (how long a killed instance blocks its peers) without also having to exceed the
      // longest possible tick — otherwise a slow tick could outlive its lease and let a
      // peer dispatch the same accounts concurrently.
      renewTimer = setInterval(
        () => {
          void lease
            .acquire()
            .then((held) => {
              if (held) return;
              // Losing the lease while alive means renewals failed long enough for it to
              // expire and a peer to claim it. If a tick is in flight, both instances may
              // now be dispatching the same accounts — the one thing the lease exists to
              // prevent — so this must never be silent.
              logger.error(
                `engine lease lost while running (this instance is ${lease.holder}); another instance has claimed it and a tick already in flight may still be dispatching`
              );
            })
            .catch((err) => logger.error("engine lease renewal failed", err));
        },
        Math.max(1000, Math.floor((leaseTtlSeconds * 1000) / 3))
      );
    },
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      // Keep renewing until the in-flight tick actually finishes: stopping the heartbeat
      // first would let the lease lapse mid-dispatch on a slow shutdown, which is exactly
      // the concurrent-dispatch window the heartbeat exists to close.
      while (running) await new Promise((r) => setTimeout(r, 50));
      if (renewTimer) {
        clearInterval(renewTimer);
        renewTimer = null;
      }
      // Hand the lease back so a redeploy's replacement instance can tick immediately
      // instead of waiting out the TTL. Best-effort: a shutdown must not fail on this,
      // and an unreleased lease only costs the TTL.
      try {
        await lease.release();
      } catch (err) {
        logger.error("engine lease release failed", err);
      }
    }
  };
}
