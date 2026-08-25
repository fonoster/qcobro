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
 * `answered` signal; the fields this recovery/DTMF path derives locally — `deliveryReason`
 * from the Fonoster CDR clearing cause (see `resolveVoiceCallFromCdr`), and `camino`/
 * `resultado`/`repeatCount` from the optional DTMF menu (see the VoiceServer) — are layered
 * on locally rather than added to the shared schema.
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
    update(args: {
      where: { id: string };
      data: {
        entrega?: Entrega;
        deliveryReason?: DeliveryReason | null;
        camino?: Camino;
        resultado?: Resultado;
        durationSeconds?: number;
        channelData: Record<string, unknown>;
      };
    }): Promise<unknown>;
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
 * `camino`/`resultado` are set only when the template's optional DTMF menu was configured and
 * the caller pressed a digit: any configured-digit press sets `camino: ENGAGED`; the opt-out
 * digit specifically also sets `resultado: OPT_OUT`. With no menu, or no/an unrecognized
 * press, both stay null exactly as before this capability (see `channelCanEngage` and its
 * `VOICE_PRERECORDED` carve-out).
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
    // entrega only ever advances: once it has left DISPATCHED it is never changed again.
    const shouldFinalize = match.entrega === "DISPATCHED";
    const entrega: Entrega | undefined = shouldFinalize ? reportedEntrega : undefined;
    const deliveryReason: DeliveryReason | undefined =
      shouldFinalize && reportedEntrega === "FAILED" ? input.deliveryReason : undefined;
    const camino: Camino | undefined = shouldFinalize ? input.camino : undefined;
    const resultado: Resultado | undefined = shouldFinalize ? input.resultado : undefined;

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = shouldFinalize
      ? { ...existing, endedAt: new Date(input.at).toISOString() }
      : existing;
    if (shouldFinalize && input.scriptDurationSeconds != null) {
      channelData.scriptDurationSeconds = input.scriptDurationSeconds;
    }
    if (shouldFinalize && input.repeatCount != null) {
      channelData.repeatCount = input.repeatCount;
    }

    // durationSeconds/channelData must only be written on the completion that actually
    // finalizes entrega (shouldFinalize) — otherwise a later, unguarded caller (e.g. the
    // timeout sweep racing a real completion that landed first) would clobber the real
    // answered duration/endedAt with its own stale/zero values even though entrega itself
    // is correctly left untouched. See voiceCompletionTimeoutSweep.
    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        ...(entrega ? { entrega } : {}),
        ...(deliveryReason ? { deliveryReason } : {}),
        ...(camino ? { camino } : {}),
        ...(resultado ? { resultado } : {}),
        ...(shouldFinalize ? { durationSeconds: input.answered ? input.answeredSeconds : 0 } : {}),
        channelData
      }
    });
    return {
      matched: true,
      id: match.id,
      entrega: entrega ?? match.entrega,
      deliveryReason: deliveryReason ?? (entrega ? null : match.deliveryReason),
      camino: camino ?? (entrega ? null : match.camino),
      resultado: resultado ?? (entrega ? null : match.resultado)
    };
  };

  return withErrorHandlingAndValidation(fn, prerecordedOutcomeInputSchema);
}
