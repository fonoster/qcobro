import {
  normalizeChatHistory,
  voiceConversationEventSchema,
  withErrorHandlingAndValidation,
  type TranscriptLine,
  type VoiceConversationEvent
} from "@qcobro/common";

/** Minimal Prisma surface this ingestion needs. */
export interface VoiceEventClient {
  accountContactLog: {
    findFirst(args: {
      where: { agentType: string; providerRef: string };
      select: { id: true; channelData: true };
    }): Promise<{ id: string; channelData: unknown } | null>;
    update(args: {
      where: { id: string };
      data: { channelData: Record<string, unknown>; durationSeconds?: number };
    }): Promise<unknown>;
  };
}

export type IngestVoiceEventResult = { matched: false } | { matched: true; id: string };

/**
 * Ingests a Fonoster autopilot conversation event into the matching Voz IA gestión.
 *
 * The gestión is created at call placement by the dispatch layer with the Fonoster call
 * ref stored as the top-level `providerRef` column (see `engine.ts` / `recordOutcome`);
 * this correlates on it via `event.callRef` and updates that record. `conversation.started`
 * records partial progress (a `startedAt` marker) so we retain data even if the call never
 * ends cleanly; `conversation.ended` adds the transcript (from chatHistory), recording URL,
 * and duration. AI analysis is produced separately and is intentionally not written here.
 *
 * Correlation is a direct lookup on the indexed `providerRef` column — NOT on a
 * `channelData.providerRef` JSON field, which the dispatch layer never writes.
 */
export function createIngestVoiceEvent(client: VoiceEventClient) {
  const fn = async (event: VoiceConversationEvent): Promise<IngestVoiceEventResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { agentType: "VOICE_AI", providerRef: event.callRef },
      select: { id: true, channelData: true }
    });
    if (!match) return { matched: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = { ...existing, appRef: event.appRef };

    if (event.eventType === "conversation.started") {
      channelData.startedAt = new Date().toISOString();
    } else {
      const transcript = normalizeChatHistory(event.chatHistory);
      if (transcript.length > 0) {
        channelData.transcript = transcript;
        channelData.transcriptText = transcript
          .map((l: TranscriptLine) => `${l.role}: ${l.text}`)
          .join("\n");
      }
      if (event.recordingUrl) channelData.recordingUrl = event.recordingUrl;
      channelData.endedAt = new Date().toISOString();
    }

    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        channelData,
        ...(event.durationSeconds != null ? { durationSeconds: event.durationSeconds } : {})
      }
    });
    return { matched: true, id: match.id };
  };

  return withErrorHandlingAndValidation(fn, voiceConversationEventSchema);
}
