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
    findMany(args: {
      where: { agentType: string };
      orderBy: { contactedAt: "desc" };
      take: number;
      select: { id: true; channelData: true };
    }): Promise<{ id: string; channelData: unknown }[]>;
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
 * The gestión is created at call placement by the dispatch layer with
 * `channelData.providerRef = callRef`; this updates that record by correlating on the
 * call ref. `conversation.started` records partial progress (a `startedAt` marker) so we
 * retain data even if the call never ends cleanly; `conversation.ended` adds the
 * transcript (from chatHistory), recording URL, and duration. AI analysis is produced
 * separately and is intentionally not written here.
 *
 * Correlation scans recent VOICE_AI logs in memory because SQLite cannot filter on a JSON
 * field; a future migration could promote `providerRef` to an indexed column.
 */
export function createIngestVoiceEvent(client: VoiceEventClient) {
  const fn = async (event: VoiceConversationEvent): Promise<IngestVoiceEventResult> => {
    const recent = await client.accountContactLog.findMany({
      where: { agentType: "VOICE_AI" },
      orderBy: { contactedAt: "desc" },
      take: 500,
      select: { id: true, channelData: true }
    });

    const match = recent.find(
      (r) => (r.channelData as { providerRef?: string } | null)?.providerRef === event.callRef
    );
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
