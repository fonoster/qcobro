import { getLogger } from "@fonoster/logger";
import { config } from "../../config.js";
import { prisma } from "../../db.js";
import { FonosterOutboundCallClient } from "../../services/fonosterOutboundCallClient.js";
import { createSettleVoiceUsage } from "../billing/settleVoiceUsage.js";
import { createRecordVoiceAiCallStatus } from "./recordVoiceAiCallStatus.js";
import { createRecordPrerecordedOutcome } from "./recordPrerecordedOutcome.js";
import { createVoiceCompletionTimeoutSweep } from "./voiceCompletionTimeoutSweep.js";

const logger = getLogger({ service: "voice-completion-sweep", filePath: import.meta.url });

export interface VoiceCompletionSweepRunner {
  stop(): void;
}

/**
 * Starts the voice completion sweep on its own interval — independent of the campaigns
 * engine and its `engine.enabled` gate. The sweep finalizes VOICE_AI/VOICE_PRERECORDED
 * gestiones stuck at `delivery: DISPATCHED`, and that happens on every dispatch path, not
 * only campaign-triggered ones (manual/ad-hoc outreach originates calls too); piggybacking
 * this on the engine's tick, as it used to, left those calls unfinalized whenever the
 * engine was off. Returns null when voice isn't configured at all — there is nothing to
 * sweep without a Fonoster client to query CDRs from.
 */
export function startVoiceCompletionSweep(): VoiceCompletionSweepRunner | null {
  if (!config.fonoster) {
    logger.verbose("disabled (no fonoster configuration)");
    return null;
  }

  const outboundCallClient = new FonosterOutboundCallClient(config.fonoster);

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
    backstopMinutes: config.voiceCompletionSweep.backstopMinutes,
    now: () => new Date()
  });

  let running = false;
  async function runOnce(): Promise<void> {
    if (running) return; // single-flight, same as the engine tick
    running = true;
    try {
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
    stop() {
      clearInterval(timer);
    }
  };
}
