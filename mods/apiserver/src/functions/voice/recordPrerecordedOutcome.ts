import { z } from "zod";
import {
  caminoSchema,
  deliveryReasonSchema,
  prerecordedCompletionSchema,
  resultadoSchema,
  withErrorHandlingAndValidation,
  type Camino,
  type DeliveryReason,
  type Entrega,
  type Resultado
} from "@qcobro/common";

/**
 * `prerecordedCompletionSchema` (in `@qcobro/common`) still carries only the boolean
 * `answered` signal; the fields this path derives locally — `deliveryReason` for an
 * unanswered call, and `camino`/`resultado`/`repeatCount` from call completion / the
 * optional DTMF menu (see the VoiceServer) — are layered on locally rather than added to the
 * shared schema.
 */
const prerecordedOutcomeInputSchema = prerecordedCompletionSchema.extend({
  deliveryReason: deliveryReasonSchema.optional(),
  camino: caminoSchema.optional(),
  resultado: resultadoSchema.optional(),
  repeatCount: z.number().int().nonnegative().optional()
});
export type PrerecordedOutcomeInput = z.infer<typeof prerecordedOutcomeInputSchema>;

/** Minimal Prisma surface this completion needs. */
export interface PrerecordedOutcomeClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "VOICE_PRERECORDED" };
      select: {
        id: true;
        entrega: true;
        deliveryReason: true;
        camino: true;
        resultado: true;
        channelData: true;
      };
    }): Promise<{
      id: string;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      camino: Camino | null;
      resultado: Resultado | null;
      channelData: unknown;
    } | null>;
    /**
     * Guarded, conditional finalize: `where.entrega: "DISPATCHED"` is re-checked by
     * Postgres against the row's live committed value at write time (not the stale value
     * read earlier by `findFirst`), so of two concurrent finalizers — the in-process
     * VoiceServer completion and `voiceCompletionTimeoutSweep` — racing for the same row,
     * exactly one `count` comes back 1 and applies; the other comes back 0 and is a safe
     * no-op, regardless of which one's write physically reaches the database last.
     */
    updateMany(args: {
      where: { id: string; entrega: "DISPATCHED" };
      data: {
        entrega: Entrega;
        deliveryReason: DeliveryReason | null;
        camino: Camino | null;
        resultado: Resultado | null;
        durationSeconds: number;
        channelData: Record<string, unknown>;
      };
    }): Promise<{ count: number }>;
  };
}

export type RecordPrerecordedOutcomeResult =
  | { matched: false }
  | {
      matched: true;
      id: string;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      camino: Camino | null;
      resultado: Resultado | null;
    };

/**
 * Records a PRE-RECORDED call's result onto its gestión, IN-PROCESS (no HTTP callback).
 *
 * The gestión is created at dispatch with `providerRef = callRef` and `entrega: DISPATCHED`;
 * this enriches that row on completion.
 *
 * `DELIVERED` means the call was ANSWERED **and** the script played to completion — that we
 * played the message out, never a claim that the account holder listened to it. Answering
 * alone is not delivery: a network element can answer and clear in under a second, and a
 * session can die mid-verb leaving the callee holding silence. Both pick up; neither hears
 * anything. Those record `FAILED` with `UNREACHABLE`, which is transient, so the account
 * stays eligible for another attempt — correct, since the message never arrived. An
 * unanswered completion records `FAILED` with its own `deliveryReason` and zero duration.
 *
 * `durationSeconds` is the answered duration whenever the call connected, including when the
 * script did not play. Time on the line is real either way; a call stranded in silence for
 * two minutes was two minutes long, it just was not a delivery.
 *
 * `camino` mirrors Voz IA's `decideCamino`: the script playing to the end (menu or no menu,
 * press or no press) means the account holder heard the message, so `camino: ENGAGED` is
 * recorded alongside a delivered completion. A completion that played nothing records no
 * `camino` — nothing was heard and nothing was pressed. `resultado: OPT_OUT` is set only when
 * the template's optional DTMF menu was configured and the caller specifically pressed the
 * opt-out digit (see `channelCanEngage` and its `VOICE_PRERECORDED` carve-out).
 *
 * Idempotent per call ref: `entrega` only ever advances, and `camino`/`resultado` are written
 * only alongside that same finalizing completion — once a gestión has left `DISPATCHED`, a
 * repeated completion preserves all three unchanged, mirroring `recordOutcomeTx`. Billing
 * settlement is triggered separately (and is itself idempotent via `settledAt`).
 */
export function createRecordPrerecordedOutcome(client: PrerecordedOutcomeClient) {
  const fn = async (input: PrerecordedOutcomeInput): Promise<RecordPrerecordedOutcomeResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_PRERECORDED" },
      select: {
        id: true,
        entrega: true,
        deliveryReason: true,
        camino: true,
        resultado: true,
        channelData: true
      }
    });
    if (!match) return { matched: false };

    // Answering is not delivering. A network element can answer and clear immediately,
    // and a session can die mid-verb leaving the callee holding silence — both pick up,
    // neither hears the message. DELIVERED requires that we actually played it out.
    const delivered = input.answered && input.scriptCompleted;
    const reportedEntrega: Entrega = delivered ? "DELIVERED" : "FAILED";
    const reportedDeliveryReason: DeliveryReason | null =
      reportedEntrega === "FAILED"
        ? // An answered call whose script never played is UNREACHABLE rather than the
          // caller-supplied reason: we reached the line but not the account holder.
          // UNREACHABLE is transient, so the account stays eligible for another attempt.
          (input.deliveryReason ?? (input.answered ? "UNREACHABLE" : null))
        : null;
    const reportedCamino: Camino | null = input.camino ?? null;
    const reportedResultado: Resultado | null = input.resultado ?? null;

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = {
      ...existing,
      endedAt: new Date(input.at).toISOString()
    };
    if (input.scriptDurationSeconds != null) {
      channelData.scriptDurationSeconds = input.scriptDurationSeconds;
    }
    if (input.repeatCount != null) {
      channelData.repeatCount = input.repeatCount;
    }

    // Guarded at the database, not at this earlier read: `where.entrega: "DISPATCHED"` is
    // re-checked by Postgres against the row's live value when it applies the update, so
    // exactly one of two racing finalizers (this call vs. voiceCompletionTimeoutSweep) ever
    // wins, however their reads and writes happen to interleave.
    const { count } = await client.accountContactLog.updateMany({
      where: { id: match.id, entrega: "DISPATCHED" },
      data: {
        entrega: reportedEntrega,
        deliveryReason: reportedDeliveryReason,
        camino: reportedCamino,
        resultado: reportedResultado,
        // Keyed on `answered`, not on delivery: a connected call that played nothing
        // still occupied the line for a real number of seconds, and that is what was
        // billed. Only a call that never connected records zero.
        durationSeconds: input.answered ? input.answeredSeconds : 0,
        channelData
      }
    });

    if (count === 1) {
      return {
        matched: true,
        id: match.id,
        entrega: reportedEntrega,
        deliveryReason: reportedDeliveryReason,
        camino: reportedCamino,
        resultado: reportedResultado
      };
    }

    // Lost the race (or the row had already finalized before our read): report the state
    // that actually won rather than the one we would have written.
    if (match.entrega !== "DISPATCHED") {
      return {
        matched: true,
        id: match.id,
        entrega: match.entrega,
        deliveryReason: match.deliveryReason,
        camino: match.camino,
        resultado: match.resultado
      };
    }
    const current = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_PRERECORDED" },
      select: {
        id: true,
        entrega: true,
        deliveryReason: true,
        camino: true,
        resultado: true,
        channelData: true
      }
    });
    return current
      ? {
          matched: true,
          id: current.id,
          entrega: current.entrega,
          deliveryReason: current.deliveryReason,
          camino: current.camino,
          resultado: current.resultado
        }
      : { matched: false };
  };

  return withErrorHandlingAndValidation(fn, prerecordedOutcomeInputSchema);
}
