import { getLogger } from "@fonoster/logger";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { FonosterOutboundCallClient } from "../../services/fonosterOutboundCallClient.js";
import { createEngineLease } from "../../engine/lease.js";
import { createSettleVoiceUsage } from "../billing/settleVoiceUsage.js";
import { createRecordVoiceAiCallStatus } from "./recordVoiceAiCallStatus.js";
import { createRecordPrerecordedOutcome } from "./recordPrerecordedOutcome.js";
import { createVoiceCompletionTimeoutSweep } from "./voiceCompletionTimeoutSweep.js";

const logger = getLogger({ service: "voice-completion-sweep", filePath: import.meta.url });

/**
 * A distinct lease row from the campaigns engine's own (`LEASE_ID` in `lease.ts`) — the
 * sweep now runs on its own interval, independent of the engine, and must not contend with
 * it for the same row.
 */
const SWEEP_LEASE_ID = "voice-completion-sweep";

export interface VoiceCompletionSweepRunner {
  stop(): Promise<void>;
}

/**
 * Starts the voice completion sweep on its own interval — independent of the campaigns
 * engine and its `engine.enabled` gate. The sweep finalizes VOICE_AI/VOICE_PRERECORDED
 * gestiones stuck at `delivery: DISPATCHED`, and that happens on every dispatch path, not
 * only campaign-triggered ones (manual/ad-hoc outreach originates calls too); piggybacking
 * this on the engine's tick, as it used to, left those calls unfinalized whenever the
 * engine was off. Returns null when voice isn't configured at all — there is nothing to
 * sweep without a Fonoster client to query CDRs from.
 *
 * Guarded by its own lease row (see `lease.ts`), the same mechanism the campaigns engine
 * uses for exactly-one-instance ticking: on a multi-replica deployment, a bare `setInterval`
 * with only an in-process `running` flag would let every replica run a full pass
 * concurrently — up to `batchSize` (200) sequential `Calls.getCall` RPCs and one
 * `settleVoiceUsage` call per finalized gestión, each times the replica count.
 */
export function startVoiceCompletionSweep(): VoiceCompletionSweepRunner | null {
  if (!config.fonoster) {
    logger.verbose("disabled (no fonoster configuration)");
    return null;
  }

  const outboundCallClient = new FonosterOutboundCallClient(config.fonoster);
  // Not renewed on a separate heartbeat like the engine's — a fresh acquire() every pass
  // both claims and renews, so the TTL only needs to outlive one pass. Sized generously
  // above the sweep interval so a slow pass (200 sequential CDR lookups) doesn't let the
  // lease lapse mid-pass and hand a peer the same window.
  const lease = createEngineLease(prisma, {
    id: SWEEP_LEASE_ID,
    ttlSeconds: Math.max(120, config.voiceCompletionSweep.intervalSeconds * 3)
  });

  // Must settle billing the same way the channel-specific completion paths already do, or
  // a timed-out call keeps its dispatch-time usage estimate forever (an overcharge). Every
  // sweep-driven finalize reports 0 answered seconds, so this always nets the estimate to
  // zero — correct, since the sweep never finalizes a gestión as answered.
  const settleTimeoutUsage = config.billing?.enabled
    ? createSettleVoiceUsage(prisma as never)
    : null;
  function withTimeoutSettlement<
    T extends { providerRef: string; answeredSeconds: number; at: string }
  >(record: (input: T) => Promise<unknown>) {
    return async (input: T) => {
      if (settleTimeoutUsage) {
        void settleTimeoutUsage({
          providerRef: input.providerRef,
          answeredSeconds: input.answeredSeconds,
          at: input.at
        }).catch((err: unknown) =>
          logger.error(`[billing] sweep settlement failed providerRef=${input.providerRef}:`, err)
        );
      }
      return record(input);
    };
  }

  const sweep = createVoiceCompletionTimeoutSweep({
    client: prisma as never,
    outboundCallClient,
    recordVoiceAiCallStatus: withTimeoutSettlement(createRecordVoiceAiCallStatus(prisma as never)),
    recordPrerecordedOutcome: withTimeoutSettlement(
      createRecordPrerecordedOutcome(prisma as never)
    ),
    floorMinutes: config.voiceCompletionSweep.floorMinutes,
    graceSeconds: config.voiceCompletionSweep.graceSeconds,
    notOriginatedMinutes: config.voiceCompletionSweep.notOriginatedMinutes,
    backstopMinutes: config.voiceCompletionSweep.backstopMinutes,
    now: () => new Date()
  });

  let running = false;
  async function runOnce(): Promise<void> {
    if (running) return; // single-flight, same as the engine tick
    running = true;
    try {
      // Multi-replica guard: only the instance holding the lease runs a pass. Unlike the
      // engine, there is no separate renewal heartbeat — each pass's acquire() both claims
      // and renews, which is enough at this cadence (the TTL is sized well above it).
      if (!(await lease.acquire())) {
        logger.verbose(
          `sweep pass skipped — lease held by another instance (this one is ${lease.holder})`
        );
        return;
      }
      const n = await sweep();
      if (n > 0) logger.verbose(`voice completion sweep: finalized ${n} gestión(es)`);
    } catch (err) {
      logger.error("voice completion sweep failed", err);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(
    () => void runOnce(),
    config.voiceCompletionSweep.intervalSeconds * 1000
  );
  void runOnce(); // don't wait a full interval before the first pass
  logger.verbose(`started — every ${config.voiceCompletionSweep.intervalSeconds}s`);

  return {
    async stop() {
      clearInterval(timer);
      while (running) await new Promise((r) => setTimeout(r, 50));
      // Best-effort: hand the lease back so a redeploy's replacement instance doesn't wait
      // out the TTL. A failure here only costs that TTL, never correctness.
      try {
        await lease.release();
      } catch (err) {
        logger.error("voice completion sweep lease release failed", err);
      }
    }
  };
}
