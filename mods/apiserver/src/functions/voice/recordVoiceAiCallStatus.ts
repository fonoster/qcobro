import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  deliveryReasonSchema,
  pathSchema,
  voiceAiCallStatusCompletionSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type Delivery,
  type Path
} from "@qcobro/common";

/**
 * `voiceAiCallStatusCompletionSchema` (in `@qcobro/common`) still carries only the boolean
 * `answered` signal; the `deliveryReason` this call-status-tracking recovery path derives
 * from the Fonoster CDR clearing cause (see `resolveVoiceCallFromCdr`), and the `path` it
 * derives from the CDR's `amdStatus` (see `voiceCompletionTimeoutSweep`'s `classify`), are
 * layered on locally rather than added to the shared schema.
 */
const voiceAiCallStatusInputSchema = voiceAiCallStatusCompletionSchema.extend({
  deliveryReason: deliveryReasonSchema.optional(),
  /** `ANSWERED_BY_MACHINE` when the sweep's CDR lookup reported `amdStatus: MACHINE`; unset
   *  otherwise. The only way a `VOICE_AI` gestión's `path` is ever set from this recovery
   *  path — see `account-contact-log`'s voice completion sweep requirement. */
  path: pathSchema.optional()
});
export type VoiceAiCallStatusInput = z.infer<typeof voiceAiCallStatusInputSchema>;

/** Minimal Prisma surface this completion needs. */
export interface VoiceAiCallStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "VOICE_AI" };
      select: { id: true; delivery: true; deliveryReason: true; channelData: true };
    }): Promise<{
      id: string;
      delivery: Delivery;
      deliveryReason: DeliveryReason | null;
      channelData: unknown;
    } | null>;
    /**
     * Guarded, conditional finalize: `where.delivery: "DISPATCHED"` is re-checked by
     * Postgres against the row's live committed value at write time (not the stale value
     * read earlier by `findFirst`), so of two concurrent finalizers — the live completion
     * webhook and `voiceCompletionTimeoutSweep` — racing for the same row, exactly one
     * `count` comes back 1 and applies; the other comes back 0 and is a safe no-op,
     * regardless of which one's write physically reaches the database last.
     *
     * `where.channelData.equals` makes the `channelData` merge a compare-and-set on the value
     * that was read: a concurrent write to it (the transcript ingest) makes the update miss
     * instead of being erased by a merge built from the stale read.
     */
    updateMany(args: {
      where: { id: string; delivery: "DISPATCHED"; channelData: { equals: unknown } };
      data: {
        delivery: Delivery;
        deliveryReason: DeliveryReason | null;
        durationSeconds: number;
        channelData: Record<string, unknown>;
        path?: Path;
      };
    }): Promise<{ count: number }>;
  };
}

export type RecordVoiceAiCallStatusResult =
  | { matched: false }
  | { matched: true; id: string; delivery: Delivery; deliveryReason: DeliveryReason | null };

/** Compare-and-set attempts before giving up on a `channelData` that keeps changing. */
const MAX_ATTEMPTS = 3;

/**
 * Finalizes a VOICE_AI gestión from Fonoster call-status tracking — the recovery path for
 * a call whose autopilot `conversation.started`/`conversation.ended` webhook never fires,
 * most commonly because the call was never answered (see `voice-call-status-tracking`).
 *
 * Mirrors {@link createRecordPrerecordedOutcome}: an unanswered call finalizes
 * `delivery: FAILED` with the CDR-derived `deliveryReason` and zero duration; an answered
 * call finalizes `delivery: DELIVERED` with the real answered duration (recovered from the
 * Fonoster CDR by the caller — never fabricated).
 *
 * Idempotent per call ref: `delivery` only ever advances. Once it has left the dispatch-time
 * `DISPATCHED` (whether by the autopilot webhook or a prior call to this function), a
 * repeated completion preserves the existing `delivery`/`deliveryReason` and does not
 * overwrite them.
 */
export function createRecordVoiceAiCallStatus(client: VoiceAiCallStatusClient) {
  const fn = async (input: VoiceAiCallStatusInput): Promise<RecordVoiceAiCallStatusResult> => {
    const read = () =>
      client.accountContactLog.findFirst({
        where: { providerRef: input.providerRef, agentType: "VOICE_AI" },
        select: { id: true, delivery: true, deliveryReason: true, channelData: true }
      });
    let match = await read();
    if (!match) return { matched: false };

    const reportedDelivery: Delivery = input.answered ? "DELIVERED" : "FAILED";
    const reportedDeliveryReason: DeliveryReason | null =
      reportedDelivery === "FAILED" ? (input.deliveryReason ?? null) : null;
    const endedAt = new Date(input.at).toISOString();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Guarded at the database, not at this earlier read: `where.delivery: "DISPATCHED"` is
      // re-checked by Postgres against the row's live value when it applies the update, so
      // exactly one of two racing finalizers (this call vs. voiceCompletionTimeoutSweep) ever
      // wins, however their reads and writes happen to interleave. `where.channelData` keeps
      // a transcript stored after our read from being erased by the merge. `path` is written
      // only when given, so a path the outcome decision already recorded survives.
      const { count } = await client.accountContactLog.updateMany({
        where: {
          id: match.id,
          delivery: "DISPATCHED",
          channelData: { equals: match.channelData ?? Prisma.DbNull }
        },
        data: {
          delivery: reportedDelivery,
          deliveryReason: reportedDeliveryReason,
          durationSeconds: input.answeredSeconds,
          channelData: {
            ...((match.channelData as Record<string, unknown> | null) ?? {}),
            endedAt
          },
          ...(input.path ? { path: input.path } : {})
        }
      });

      if (count === 1) {
        return {
          matched: true,
          id: match.id,
          delivery: reportedDelivery,
          deliveryReason: reportedDeliveryReason
        };
      }

      // Lost the race (or the row had already finalized before our read): report the state
      // that actually won rather than the one we would have written.
      if (match.delivery !== "DISPATCHED") break;
      const current = await read();
      if (!current) return { matched: false };
      match = current;
      // Still DISPATCHED: `channelData` changed under us. Retry with the fresh value.
      if (match.delivery !== "DISPATCHED") break;
    }

    // Either another finalizer won, or every attempt missed while the row stayed DISPATCHED:
    // report the row as it reads now.
    return {
      matched: true,
      id: match.id,
      delivery: match.delivery,
      deliveryReason: match.deliveryReason
    };
  };

  return withErrorHandlingAndValidation(fn, voiceAiCallStatusInputSchema);
}

/** Prisma-backed {@link VoiceAiCallStatusClient}. */
export function createPrismaVoiceAiCallStatusClient(prisma: PrismaClient): VoiceAiCallStatusClient {
  return prisma as unknown as VoiceAiCallStatusClient;
}
