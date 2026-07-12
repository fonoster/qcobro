import { z } from "zod";

/**
 * Events emitted by the Fonoster autopilot events-hook for a Voz IA call.
 * `conversation.started` lets us capture partial data even if the call never ends
 * cleanly; `conversation.ended` carries the transcript and recording.
 */
export const voiceEventTypeSchema = z.enum(["conversation.started", "conversation.ended"]);
export type VoiceEventType = z.infer<typeof voiceEventTypeSchema>;

/**
 * A raw chat-history entry from the autopilot: `{ ai: text }` (our agent) or
 * `{ human: text }` (the customer). Kept permissive — only the ai/human keys are read.
 */
export const voiceChatMessageSchema = z.record(z.string(), z.unknown());

export const voiceConversationEventSchema = z.object({
  eventType: voiceEventTypeSchema,
  appRef: z.string().min(1),
  callRef: z.string().min(1),
  phone: z.string().min(1),
  chatHistory: z.array(voiceChatMessageSchema).optional(),
  recordingUrl: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional()
});
export type VoiceConversationEvent = z.infer<typeof voiceConversationEventSchema>;

/**
 * In-process completion signal for a PRE-RECORDED call, reported by the co-located
 * VoiceServer (not an HTTP callback like Voz IA). `answered` distinguishes a connected
 * call from one that never picked up; `answeredSeconds` is the answer→hangup duration
 * (0 when unanswered). `scriptDurationSeconds` is the nominal length of the synthesized
 * clip, stored so a future report can compare it against the answered duration.
 */
export const prerecordedCompletionSchema = z.object({
  providerRef: z.string().min(1),
  answered: z.boolean(),
  answeredSeconds: z.number().int().nonnegative(),
  scriptDurationSeconds: z.number().int().nonnegative().optional(),
  at: z.string().min(1)
});
export type PrerecordedCompletionInput = z.infer<typeof prerecordedCompletionSchema>;

/** A normalized transcript line stored in `channelData.transcript` for the console. */
export interface TranscriptLine {
  role: "agent" | "customer";
  text: string;
}

/** Normalize autopilot chatHistory into ordered console transcript lines. */
export function normalizeChatHistory(
  chatHistory: ReadonlyArray<Record<string, unknown>> | undefined
): TranscriptLine[] {
  if (!chatHistory) return [];
  const lines: TranscriptLine[] = [];
  for (const entry of chatHistory) {
    if (typeof entry.ai === "string") lines.push({ role: "agent", text: entry.ai });
    else if (typeof entry.human === "string") lines.push({ role: "customer", text: entry.human });
  }
  return lines;
}
