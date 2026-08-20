import { z } from "zod";
import {
  deliveryReasonSchema,
  prerecordedCompletionSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type Entrega
} from "@qcobro/common";

/**
 * `prerecordedCompletionSchema` (in `@qcobro/common`) still carries only the boolean
 * `answered` signal; the `deliveryReason` this recovery path derives from the Fonoster CDR
 * clearing cause (see `resolveVoiceCallFromCdr`) is layered on locally rather than added to
 * the shared schema.
 */
const prerecordedOutcomeInputSchema = prerecordedCompletionSchema.extend({
  deliveryReason: deliveryReasonSchema.optional()
});
export type PrerecordedOutcomeInput = z.infer<typeof prerecordedOutcomeInputSchema>;

/** Minimal Prisma surface this completion needs. */
export interface PrerecordedOutcomeClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "VOICE_PRERECORDED" };
      select: { id: true; entrega: true; deliveryReason: true; channelData: true };
    }): Promise<{
      id: string;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      channelData: unknown;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        entrega?: Entrega;
        deliveryReason?: DeliveryReason | null;
        durationSeconds: number;
        channelData: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
}

export type RecordPrerecordedOutcomeResult =
  | { matched: false }
  | { matched: true; id: string; entrega: Entrega; deliveryReason: DeliveryReason | null };

/**
 * Records a PRE-RECORDED call's result onto its gestión, IN-PROCESS (no HTTP callback).
 *
 * The gestión is created at dispatch with `providerRef = callRef` and `entrega: DISPATCHED`;
 * this enriches that row on completion. `DELIVERED` means the call was ANSWERED — never a
 * claim that the account holder heard the message — and carries the answered
 * `durationSeconds` (the honest signal, never fabricated). An unanswered completion records
 * `FAILED` with a `deliveryReason` and zero duration. `camino`/`resultado` are never set
 * here — VOICE_PRERECORDED has no inbound path (see `channelCanEngage`).
 *
 * Idempotent per call ref: `entrega` only ever advances. Once it has left `DISPATCHED` (no
 * longer the dispatch-time state), a repeated completion preserves it and does not
 * downgrade — mirroring `recordOutcomeTx`. Billing settlement is triggered separately (and
 * is itself idempotent via `settledAt`).
 */
export function createRecordPrerecordedOutcome(client: PrerecordedOutcomeClient) {
  const fn = async (input: PrerecordedOutcomeInput): Promise<RecordPrerecordedOutcomeResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_PRERECORDED" },
      select: { id: true, entrega: true, deliveryReason: true, channelData: true }
    });
    if (!match) return { matched: false };

    const reportedEntrega: Entrega = input.answered ? "DELIVERED" : "FAILED";
    // entrega only ever advances: once it has left DISPATCHED it is never changed again.
    const shouldFinalize = match.entrega === "DISPATCHED";
    const entrega: Entrega | undefined = shouldFinalize ? reportedEntrega : undefined;
    const deliveryReason: DeliveryReason | undefined =
      shouldFinalize && reportedEntrega === "FAILED" ? input.deliveryReason : undefined;

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = {
      ...existing,
      endedAt: new Date(input.at).toISOString()
    };
    if (input.scriptDurationSeconds != null) {
      channelData.scriptDurationSeconds = input.scriptDurationSeconds;
    }

    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        ...(entrega ? { entrega } : {}),
        ...(deliveryReason ? { deliveryReason } : {}),
        durationSeconds: input.answered ? input.answeredSeconds : 0,
        channelData
      }
    });
    return {
      matched: true,
      id: match.id,
      entrega: entrega ?? match.entrega,
      deliveryReason: deliveryReason ?? (entrega ? null : match.deliveryReason)
    };
  };

  return withErrorHandlingAndValidation(fn, prerecordedOutcomeInputSchema);
}
