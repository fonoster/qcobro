import { getLogger } from "@fonoster/logger";
import type { DeliveryReason, OutboundCallClient } from "@qcobro/common";
import { mapVoiceCallStatusToDeliveryReason } from "./mapVoiceCallStatusToDeliveryReason.js";

const logger = getLogger({ service: "voice-completion-sweep", filePath: import.meta.url });

/** Minimal Prisma surface this sweep needs. */
export interface StaleVoiceDispatchClient {
  accountContactLog: {
    findMany(args: {
      where: {
        delivery: "DISPATCHED";
        agentType: { in: ["VOICE_AI", "VOICE_PRERECORDED"] };
        providerRef: { not: null };
        contactedAt: { lt: Date };
      };
      select: { id: true; providerRef: true; agentType: true; contactedAt: true };
      take: number;
    }): Promise<
      {
        id: string;
        providerRef: string;
        agentType: "VOICE_AI" | "VOICE_PRERECORDED";
        contactedAt: Date;
      }[]
    >;
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
  /** CDR lookup — the sweep's only use of the provider client. */
  outboundCallClient: Pick<OutboundCallClient, "getCall">;
  recordVoiceAiCallStatus: VoiceOutcomeRecorder;
  recordPrerecordedOutcome: VoiceOutcomeRecorder;
  /**
   * Minutes a gestión may sit at DISPATCHED before the sweep starts consulting its CDR.
   * Short: a lookup is cheap, and a call that has genuinely ended should close out quickly.
   */
  floorMinutes: number;
  /**
   * Seconds a terminal CDR must have been ended for (per the CDR's own `endedAt`) before the
   * sweep will finalize from it. The CDR write and the channel's own live completion signal
   * race the same event; this is what keeps the sweep from winning that race and permanently
   * discarding a real answered outcome. See {@link classify}.
   */
  graceSeconds: number;
  /**
   * Minutes past which a gestión whose CDR still carries no status (the provider lost the
   * end-of-call record, or never writes one) is finalized anyway, `deliveryReason:
   * OUTCOME_UNKNOWN`, rather than polled forever.
   */
  backstopMinutes: number;
  now: () => Date;
  batchSize?: number;
}

/**
 * Finalizes VOICE_AI / VOICE_PRERECORDED gestiones stuck at `delivery: DISPATCHED` past
 * `floorMinutes` with no completion signal — the autopilot `conversation.ended` webhook
 * never arrived, or the pre-recorded VoiceServer's answer/say/hangup verb chain never
 * resolved (neither has a timeout of its own). Classifies each one from Fonoster's call
 * detail record (CDR, `Calls.getCall`) instead of always guessing `PROVIDER_ERROR`:
 *
 * - The CDR has a terminal status (the call has cleared, one way or another) AND has been
 *   ended for at least `graceSeconds`: finalize `FAILED` with the reason
 *   {@link mapVoiceCallStatusToDeliveryReason} maps it to. The grace matters because the CDR
 *   write and the channel's own live completion signal (the autopilot webhook, the
 *   co-located VoiceServer) are triggered by the same event and race — the sweep's DB-guarded
 *   write is final for whichever side reaches it first, so finalizing the instant the CDR
 *   clears could permanently discard a real answered outcome that was merely still in
 *   flight. A terminal CDR still inside its grace window is treated exactly like one with no
 *   status yet: left alone for a later pass.
 * - The CDR exists but carries no status yet (only the start portion was written — the
 *   call is still in progress): leave the gestión at DISPATCHED. A later sweep pass
 *   decides once the call actually ends, or the backstop below fires. This is not a
 *   failure and must not be treated as one.
 * - No CDR at all (Fonoster's `NOT_FOUND`): the call never originated. Finalize `FAILED` /
 *   `NOT_ORIGINATED`. No grace applies — there is no live completion signal to race with.
 * - Backstop: a gestión still with no status past `backstopMinutes` is finalized `FAILED` /
 *   `OUTCOME_UNKNOWN` rather than polled forever — the provider can lose the end record.
 *
 * Never passes the CDR's own duration (measured from call setup and including ring time)
 * as `answeredSeconds` — every sweep-driven finalize is a failure, so `answeredSeconds` is
 * always 0 and `durationSeconds` is left alone. Idempotence is enforced by
 * `recordVoiceAiCallStatus`/`recordPrerecordedOutcome` themselves (a DB-level guarded
 * update keyed on `delivery: DISPATCHED` still being true at write time): if a live
 * completion signal finalizes the same gestión concurrently, whichever write lands first
 * wins and the other becomes a safe no-op that touches neither `durationSeconds` nor
 * `channelData`.
 */
export function createVoiceCompletionTimeoutSweep(
  deps: VoiceCompletionTimeoutSweepDeps
): () => Promise<number> {
  return async (): Promise<number> => {
    const cutoff = new Date(deps.now().getTime() - deps.floorMinutes * 60_000);
    let stale: Awaited<ReturnType<StaleVoiceDispatchClient["accountContactLog"]["findMany"]>>;
    try {
      stale = await deps.client.accountContactLog.findMany({
        where: {
          delivery: "DISPATCHED",
          agentType: { in: ["VOICE_AI", "VOICE_PRERECORDED"] },
          providerRef: { not: null },
          contactedAt: { lt: cutoff }
        },
        select: { id: true, providerRef: true, agentType: true, contactedAt: true },
        take: deps.batchSize ?? 200
      });
    } catch (err) {
      logger.error(
        `voice completion timeout sweep query failed: ${err instanceof Error ? err.message : err}`
      );
      return 0;
    }

    const nowMs = deps.now().getTime();
    let swept = 0;
    for (const row of stale) {
      try {
        const deliveryReason = await classify(deps, row, nowMs);
        if (deliveryReason === null) continue; // still in progress — leave it at DISPATCHED

        const at = deps.now().toISOString();
        const record =
          row.agentType === "VOICE_AI"
            ? deps.recordVoiceAiCallStatus
            : deps.recordPrerecordedOutcome;
        await record({
          providerRef: row.providerRef,
          answered: false,
          deliveryReason,
          // Never the CDR's own duration — it includes ring time and this is always a
          // failure path; a gestión's real answered duration comes only from a live
          // completion signal, never from this sweep.
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

/**
 * Looks up one gestión's CDR and decides its `deliveryReason`, or `null` when nothing should
 * be written yet — either because the call is still in progress, or because it has cleared
 * too recently to rule out a live completion signal still being in flight for it.
 */
async function classify(
  deps: VoiceCompletionTimeoutSweepDeps,
  row: { contactedAt: Date; providerRef: string },
  nowMs: number
): Promise<DeliveryReason | null> {
  const lookup = await deps.outboundCallClient.getCall(row.providerRef);

  // No grace here: with no CDR at all there is no live completion signal in flight to race
  // — the call never originated — and floorMinutes already covers the gap before Fonoster
  // writes the start portion of a real one.
  if (!lookup.found) return "NOT_ORIGINATED";

  const terminal = mapVoiceCallStatusToDeliveryReason(lookup.status);
  if (terminal !== null) {
    // The CDR write and the channel's own live completion signal race the same event. Never
    // guess in the direction that discards a real outcome: a terminal status with no usable
    // `endedAt` is treated as not yet past the grace, exactly like one that plainly is.
    if (!lookup.endedAt) return null;
    const secondsSinceEnded = (nowMs - lookup.endedAt.getTime()) / 1000;
    return secondsSinceEnded >= deps.graceSeconds ? terminal : null;
  }

  // No terminal status yet (UNKNOWN / not yet cleared). Only the backstop can close this
  // out — otherwise a call still genuinely in progress must be left alone.
  const ageMinutes = (nowMs - row.contactedAt.getTime()) / 60_000;
  return ageMinutes >= deps.backstopMinutes ? "OUTCOME_UNKNOWN" : null;
}
