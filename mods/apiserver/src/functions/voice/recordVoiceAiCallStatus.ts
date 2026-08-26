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
    /**
     * Guarded, conditional finalize: `where.entrega: "DISPATCHED"` is re-checked by
     * Postgres against the row's live committed value at write time (not the stale value
     * read earlier by `findFirst`), so of two concurrent finalizers — the live completion
     * webhook and `voiceCompletionTimeoutSweep` — racing for the same row, exactly one
     * `count` comes back 1 and applies; the other comes back 0 and is a safe no-op,
     * regardless of which one's write physically reaches the database last.
     */
    updateMany(args: {
      where: { id: string; entrega: "DISPATCHED" };
      data: {
        entrega: Entrega;
        deliveryReason: DeliveryReason | null;
        durationSeconds: number;
        channelData: Record<string, unknown>;
      };
    }): Promise<{ count: number }>;
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
    const reportedDeliveryReason: DeliveryReason | null =
      reportedEntrega === "FAILED" ? (input.deliveryReason ?? null) : null;
    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = {
      ...existing,
      endedAt: new Date(input.at).toISOString()
    };

    // Guarded at the database, not at this earlier read: `where.entrega: "DISPATCHED"` is
    // re-checked by Postgres against the row's live value when it applies the update, so
    // exactly one of two racing finalizers (this call vs. voiceCompletionTimeoutSweep) ever
    // wins, however their reads and writes happen to interleave.
    const { count } = await client.accountContactLog.updateMany({
      where: { id: match.id, entrega: "DISPATCHED" },
      data: {
        entrega: reportedEntrega,
        deliveryReason: reportedDeliveryReason,
        durationSeconds: input.answeredSeconds,
        channelData
      }
    });

    if (count === 1) {
      return {
        matched: true,
        id: match.id,
        entrega: reportedEntrega,
        deliveryReason: reportedDeliveryReason
      };
    }

    // Lost the race (or the row had already finalized before our read): report the state
    // that actually won rather than the one we would have written.
    if (match.entrega !== "DISPATCHED") {
      return {
        matched: true,
        id: match.id,
        entrega: match.entrega,
        deliveryReason: match.deliveryReason
      };
    }
    const current = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_AI" },
      select: { id: true, entrega: true, deliveryReason: true, channelData: true }
    });
    return current
      ? {
          matched: true,
          id: current.id,
          entrega: current.entrega,
          deliveryReason: current.deliveryReason
        }
      : { matched: false };
  };

  return withErrorHandlingAndValidation(fn, voiceAiCallStatusInputSchema);
}

/** Prisma-backed {@link VoiceAiCallStatusClient}. */
export function createPrismaVoiceAiCallStatusClient(prisma: PrismaClient): VoiceAiCallStatusClient {
  return prisma as unknown as VoiceAiCallStatusClient;
}
