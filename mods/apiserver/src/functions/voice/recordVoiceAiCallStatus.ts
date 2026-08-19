import type { PrismaClient } from "@prisma/client";
import {
  voiceAiCallStatusCompletionSchema,
  withErrorHandlingAndValidation,
  type ContactOutcome,
  type VoiceAiCallStatusCompletionInput
} from "@qcobro/common";

/** Minimal Prisma surface this completion needs. */
export interface VoiceAiCallStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "VOICE_AI" };
      select: { id: true; outcome: true; channelData: true };
    }): Promise<{ id: string; outcome: ContactOutcome; channelData: unknown } | null>;
    update(args: {
      where: { id: string };
      data: {
        outcome: ContactOutcome;
        durationSeconds: number;
        channelData: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
}

export type RecordVoiceAiCallStatusResult =
  | { matched: false }
  | { matched: true; id: string; outcome: ContactOutcome };

/**
 * Finalizes a VOICE_AI gestión from Fonoster call-status tracking — the recovery path for
 * a call whose autopilot `conversation.started`/`conversation.ended` webhook never fires,
 * most commonly because the call was never answered (see `voice-call-status-tracking`).
 *
 * Mirrors {@link createRecordPrerecordedOutcome}: `answered:false` finalizes `NO_ANSWER`
 * with zero duration; `answered:true` finalizes `DELIVERED` with the answered duration
 * (recovered from the Fonoster CDR by the caller — never fabricated as zero).
 *
 * Idempotent per call ref: once the outcome has left the dispatch-time `DISPATCHED`
 * placeholder (whether by the autopilot webhook or a prior call to this function), a
 * repeated completion preserves the existing outcome and does not overwrite it.
 */
export function createRecordVoiceAiCallStatus(client: VoiceAiCallStatusClient) {
  const fn = async (
    input: VoiceAiCallStatusCompletionInput
  ): Promise<RecordVoiceAiCallStatusResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_AI" },
      select: { id: true, outcome: true, channelData: true }
    });
    if (!match) return { matched: false };

    const reported: ContactOutcome = input.answered ? "DELIVERED" : "NO_ANSWER";
    // Never downgrade a finalized outcome; only the dispatch-time DISPATCHED placeholder
    // is replaced.
    const outcome: ContactOutcome = match.outcome === "DISPATCHED" ? reported : match.outcome;

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = {
      ...existing,
      endedAt: new Date(input.at).toISOString()
    };

    await client.accountContactLog.update({
      where: { id: match.id },
      data: { outcome, durationSeconds: input.answeredSeconds, channelData }
    });
    return { matched: true, id: match.id, outcome };
  };

  return withErrorHandlingAndValidation(fn, voiceAiCallStatusCompletionSchema);
}

/** Prisma-backed {@link VoiceAiCallStatusClient}. */
export function createPrismaVoiceAiCallStatusClient(prisma: PrismaClient): VoiceAiCallStatusClient {
  return prisma as unknown as VoiceAiCallStatusClient;
}
