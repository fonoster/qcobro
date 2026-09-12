import { getLogger } from "@fonoster/logger";
import type { DeliveryReason, OutboundCallClient, Path } from "@qcobro/common";
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
  path?: Path;
}) => Promise<unknown>;

/** What the sweep decided for one gestión — `null` means "still in progress, don't finalize
 *  yet". `path` is set alongside `deliveryReason`, never in its place. */
type SweepClassification = { deliveryReason: DeliveryReason; path?: Path } | null;

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
   * Minutes past dispatch before a gestión with no CDR at all is finalized `NOT_ORIGINATED`.
   * Deliberately its own, longer threshold rather than `floorMinutes`: `NOT_ORIGINATED` is
   * irreversible and there's no live signal to race, but the CDR's start record can lag
   * dispatch (Influx read lag, a queueing hiccup) — finalizing too early risks recording a
   * call that is still just about to exist as one that never happened at all.
   */
  notOriginatedMinutes: number;
  /**
   * Minutes past which a gestión whose CDR still carries no status (the provider lost the
   * end-of-call record, or never writes one) is finalized anyway, `deliveryReason:
   * OUTCOME_UNKNOWN`, rather than polled forever. Also the fallback for a terminal CDR whose
   * `endedAt` can't be parsed — see {@link classify}. Sized well above any call the platform
   * allows: the dialplan's `TIMEOUT(absolute)` caps every channel at 60 minutes, so a CDR
   * still showing no status past that has lost its end record, not one still talking.
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
 *   status yet: left alone for a later pass. A terminal CDR whose `endedAt` can't be parsed
 *   at all can't be graced either way — it falls through to the backstop below instead of
 *   stalling forever, still with the mapped reason rather than `OUTCOME_UNKNOWN`, since the
 *   CDR does say how the call cleared even without a trustworthy timestamp for it.
 * - The CDR exists but carries no status yet (only the start portion was written — the
 *   call is still in progress): leave the gestión at DISPATCHED. A later sweep pass
 *   decides once the call actually ends, or the backstop below fires. This is not a
 *   failure and must not be treated as one.
 * - No CDR at all (Fonoster's `NOT_FOUND`): finalize `FAILED` / `NOT_ORIGINATED` once
 *   `notOriginatedMinutes` have passed since dispatch — longer than `floorMinutes`, since
 *   this write is irreversible and the CDR's start record can lag dispatch.
 * - Backstop: a gestión still with no status past `backstopMinutes` is finalized `FAILED` /
 *   `OUTCOME_UNKNOWN` rather than polled forever — the provider can lose the end record.
 *
 * Whenever the CDR also reports `amdStatus: MACHINE` (Fonoster's answering-machine
 * detection), the same finalization additionally sets `path: ANSWERED_BY_MACHINE` —
 * alongside whichever `deliveryReason` applies above, never instead of one. This is the
 * only place a `VOICE_AI` gestión's `path` is ever set from AMD: the autopilot's own live
 * `conversation.ended` decision never consults the CDR (see `decideVoiceOutcome.ts`), so a
 * call that reaches a live conversation keeps `path: ENGAGED` regardless of `amdStatus`.
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
        const classification = await classify(deps, row, nowMs);
        if (classification === null) continue; // still in progress — leave it at DISPATCHED

        const at = deps.now().toISOString();
        const record =
          row.agentType === "VOICE_AI"
            ? deps.recordVoiceAiCallStatus
            : deps.recordPrerecordedOutcome;
        await record({
          providerRef: row.providerRef,
          answered: false,
          deliveryReason: classification.deliveryReason,
          // Never the CDR's own duration — it includes ring time and this is always a
          // failure path; a gestión's real answered duration comes only from a live
          // completion signal, never from this sweep.
          answeredSeconds: 0,
          at,
          ...(classification.path ? { path: classification.path } : {})
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
 * Looks up one gestión's CDR and decides its `deliveryReason` (plus `path` when the CDR
 * also reports a detected answering machine), or `null` when nothing should be written yet
 * — either because the call is still in progress, because it has cleared too recently to
 * rule out a live completion signal still being in flight for it, or because there's no CDR
 * yet and it's too soon to call that irreversible.
 */
async function classify(
  deps: VoiceCompletionTimeoutSweepDeps,
  row: { contactedAt: Date; providerRef: string },
  nowMs: number
): Promise<SweepClassification> {
  const ageMinutes = (nowMs - row.contactedAt.getTime()) / 60_000;
  const lookup = await deps.outboundCallClient.getCall(row.providerRef);

  if (!lookup.found) {
    // No grace against a live signal here — there isn't one to race, the call never
    // originated. But the write is irreversible, and the CDR's start record can lag
    // dispatch, so this gets its own (longer) age gate rather than firing at floorMinutes.
    return ageMinutes >= deps.notOriginatedMinutes ? { deliveryReason: "NOT_ORIGINATED" } : null;
  }

  // Fonoster's answering-machine detection only ever runs on an answered call, so it rides
  // alongside whichever deliveryReason the CDR maps to below — never in place of one.
  const path: Path | undefined = lookup.amdStatus === "MACHINE" ? "ANSWERED_BY_MACHINE" : undefined;

  const terminal = mapVoiceCallStatusToDeliveryReason(lookup.status);
  if (terminal !== null) {
    if (lookup.endedAt) {
      // The CDR write and the channel's own live completion signal race the same event —
      // give the live signal `graceSeconds` to land first before finalizing over it.
      const secondsSinceEnded = (nowMs - lookup.endedAt.getTime()) / 1000;
      if (secondsSinceEnded >= deps.graceSeconds) return { deliveryReason: terminal, path };
      return null;
    }
    // endedAt is unusable, so the grace can't be evaluated either way — but unlike the "no
    // status yet" branch below, the CDR does say how this call cleared. Don't stall
    // forever waiting on a timestamp that will never parse: past the backstop, finalize
    // with the mapped reason rather than the generic OUTCOME_UNKNOWN.
    return ageMinutes >= deps.backstopMinutes ? { deliveryReason: terminal, path } : null;
  }

  // No terminal status yet (UNKNOWN / not yet cleared). Only the backstop can close this
  // out — otherwise a call still genuinely in progress must be left alone.
  return ageMinutes >= deps.backstopMinutes ? { deliveryReason: "OUTCOME_UNKNOWN", path } : null;
}
