import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  deliveryReasonSchema,
  voiceAiCallStatusCompletionSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type Entrega
} from "@qcobro/common";

/**
 * `voiceAiCallStatusCompletionSchema` (in `@qcobro/common`) still carries only the boolean
 * `answered` signal; the `deliveryReason` this call-status-tracking recovery path derives
 * from the Fonoster CDR clearing cause (see `resolveVoiceCallFromCdr`) is layered on
 * locally rather than added to the shared schema.
 */
const voiceAiCallStatusInputSchema = voiceAiCallStatusCompletionSchema.extend({
  deliveryReason: deliveryReasonSchema.optional()
});
export type VoiceAiCallStatusInput = z.infer<typeof voiceAiCallStatusInputSchema>;

/** Minimal Prisma surface this completion needs. */
export interface VoiceAiCallStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "VOICE_AI" };
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

export type RecordVoiceAiCallStatusResult =
  | { matched: false }
  | { matched: true; id: string; entrega: Entrega; deliveryReason: DeliveryReason | null };

/**
 * Finalizes a VOICE_AI gestión from Fonoster call-status tracking — the recovery path for
 * a call whose autopilot `conversation.started`/`conversation.ended` webhook never fires,
 * most commonly because the call was never answered (see `voice-call-status-tracking`).
 *
 * Mirrors {@link createRecordPrerecordedOutcome}: an unanswered call finalizes
 * `entrega: FAILED` with the CDR-derived `deliveryReason` and zero duration; an answered
 * call finalizes `entrega: DELIVERED` with the real answered duration (recovered from the
 * Fonoster CDR by the caller — never fabricated).
 *
 * Idempotent per call ref: `entrega` only ever advances. Once it has left the dispatch-time
 * `DISPATCHED` (whether by the autopilot webhook or a prior call to this function), a
 * repeated completion preserves the existing `entrega`/`deliveryReason` and does not
 * overwrite them.
 */
export function createRecordVoiceAiCallStatus(client: VoiceAiCallStatusClient) {
  const fn = async (input: VoiceAiCallStatusInput): Promise<RecordVoiceAiCallStatusResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_AI" },
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

    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        ...(entrega ? { entrega } : {}),
        ...(deliveryReason ? { deliveryReason } : {}),
        durationSeconds: input.answeredSeconds,
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

  return withErrorHandlingAndValidation(fn, voiceAiCallStatusInputSchema);
}

/** Prisma-backed {@link VoiceAiCallStatusClient}. */
export function createPrismaVoiceAiCallStatusClient(prisma: PrismaClient): VoiceAiCallStatusClient {
  return prisma as unknown as VoiceAiCallStatusClient;
}
