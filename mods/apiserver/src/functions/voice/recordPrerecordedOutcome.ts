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
 * this enriches that row on completion. `DELIVERED` means the call was ANSWERED — never a
 * claim that the account holder heard the message — and carries the answered
 * `durationSeconds` (the honest signal, never fabricated). An unanswered completion records
 * `FAILED` with a `deliveryReason` and zero duration.
 *
 * `camino` mirrors Voz IA's `decideCamino`: reaching call completion at all (the script
 * played to the end, menu or no menu, press or no press — an early hangup never reaches this
 * far) means the account holder heard the message, so `camino: ENGAGED` is always recorded on
 * a finalizing completion. `resultado: OPT_OUT` is the one exception, set only when the
 * template's optional DTMF menu was configured and the caller specifically pressed the
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

    const reportedEntrega: Entrega = input.answered ? "DELIVERED" : "FAILED";
    const reportedDeliveryReason: DeliveryReason | null =
      reportedEntrega === "FAILED" ? (input.deliveryReason ?? null) : null;
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
