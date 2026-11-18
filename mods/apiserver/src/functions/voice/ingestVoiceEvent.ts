import {
  normalizeChatHistory,
  voiceTranscriptInputSchema,
  withErrorHandlingAndValidation,
  type TranscriptLine,
  type VoiceTranscriptInput
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
      data: { channelData: Record<string, unknown> };
    }): Promise<unknown>;
  };
}

export type IngestVoiceEventResult =
  | { matched: false }
  | { matched: true; id: string; stored: boolean };

/**
 * Stores a Voz IA call's transcript, taken from its sealed call record, on the matching
 * gestión: `channelData.transcript` (ordered console lines), `transcriptText`, and
 * `transcriptStoredAt`, which the decision recovery uses to tell owed work from work the
 * receiver is still doing. A history with no turns stores nothing (`stored: false`).
 *
 * Correlation is a direct lookup on the indexed `providerRef` column (the Fonoster call ref
 * the dispatch layer wrote), never a `channelData` field. AI analysis and the outcome
 * decision run separately.
 */
export function createIngestVoiceEvent(
  client: VoiceEventClient,
  now: () => Date = () => new Date()
) {
  const fn = async (input: VoiceTranscriptInput): Promise<IngestVoiceEventResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { agentType: "VOICE_AI", providerRef: input.callRef },
      select: { id: true, channelData: true }
    });
    if (!match) return { matched: false };

    const transcript = normalizeChatHistory(input.chatHistory);
    if (transcript.length === 0) return { matched: true, id: match.id, stored: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        channelData: {
          ...existing,
          transcript,
          transcriptText: transcript.map((l: TranscriptLine) => `${l.role}: ${l.text}`).join("\n"),
          transcriptStoredAt: now().toISOString()
        }
      }
    });
    return { matched: true, id: match.id, stored: true };
  };

  return withErrorHandlingAndValidation(fn, voiceTranscriptInputSchema);
}
