import { getLogger } from "@fonoster/logger";
import type { DeliveryReason } from "@qcobro/common";

const logger = getLogger({ service: "voice-completion-sweep", filePath: import.meta.url });

/** Minimal Prisma surface this sweep needs. */
export interface StaleVoiceDispatchClient {
  accountContactLog: {
    findMany(args: {
      where: {
        entrega: "DISPATCHED";
        agentType: { in: ["VOICE_AI", "VOICE_PRERECORDED"] };
        providerRef: { not: null };
        contactedAt: { lt: Date };
      };
      select: { id: true; providerRef: true; agentType: true };
      take: number;
    }): Promise<{ id: string; providerRef: string; agentType: "VOICE_AI" | "VOICE_PRERECORDED" }[]>;
  };
}

type VoiceOutcomeRecorder = (input: {
  providerRef: string;
  answered: boolean;
  deliveryReason?: DeliveryReason;
  answeredSeconds: number;
  at: string;
}) => Promise<unknown>;

export interface VoiceCompletionTimeoutSweepDeps {
  client: StaleVoiceDispatchClient;
  recordVoiceAiCallStatus: VoiceOutcomeRecorder;
  recordPrerecordedOutcome: VoiceOutcomeRecorder;
  thresholdMinutes: number;
  now: () => Date;
  batchSize?: number;
}

/**
 * Finalizes VOICE_AI / VOICE_PRERECORDED gestiones stuck at entrega=DISPATCHED past a
 * threshold with no completion signal — the autopilot conversation.ended webhook never
 * arrived, or the pre-recorded VoiceServer's answer/say/hangup verb chain never resolved
 * (neither has a timeout of its own). Always finalizes FAILED: if the call HAD been
 * answered, one of those two live signals would already have advanced entrega before
 * this runs, so the sweep only ever needs to close out the failure case.
 * deliveryReason is always PROVIDER_ERROR — with Fonoster's CDR no longer consulted,
 * there is no richer signal left to classify *why* it never completed.
 *
 * Reuses createRecordVoiceAiCallStatus / createRecordPrerecordedOutcome as-is — both are
 * idempotent (entrega only ever advances), so a race against a completion signal landing
 * in the same window is safe either order.
 */
export function createVoiceCompletionTimeoutSweep(
  deps: VoiceCompletionTimeoutSweepDeps
): () => Promise<number> {
  return async (): Promise<number> => {
    const cutoff = new Date(deps.now().getTime() - deps.thresholdMinutes * 60_000);
    let stale: Awaited<ReturnType<StaleVoiceDispatchClient["accountContactLog"]["findMany"]>>;
    try {
      stale = await deps.client.accountContactLog.findMany({
        where: {
          entrega: "DISPATCHED",
          agentType: { in: ["VOICE_AI", "VOICE_PRERECORDED"] },
          providerRef: { not: null },
          contactedAt: { lt: cutoff }
        },
        select: { id: true, providerRef: true, agentType: true },
        take: deps.batchSize ?? 200
      });
    } catch (err) {
      logger.error(
        `voice completion timeout sweep query failed: ${err instanceof Error ? err.message : err}`
      );
      return 0;
    }

    let swept = 0;
    for (const row of stale) {
      const at = deps.now().toISOString();
      try {
        const record =
          row.agentType === "VOICE_AI"
            ? deps.recordVoiceAiCallStatus
            : deps.recordPrerecordedOutcome;
        await record({
          providerRef: row.providerRef,
          answered: false,
          deliveryReason: "PROVIDER_ERROR",
          answeredSeconds: 0,
          at
        });
        swept++;
      } catch (err) {
        logger.error(
          `voice completion timeout sweep failed id=${row.id} providerRef=${row.providerRef}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }
    return swept;
  };
}
