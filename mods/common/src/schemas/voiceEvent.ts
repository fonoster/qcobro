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
 * VoiceServer (not an HTTP callback like Voz IA).
 *
 * `answered` and `scriptCompleted` are two different facts and both are needed:
 * `answered` says the callee picked up, `scriptCompleted` says the message actually
 * played out to the end. A call can be answered and play nothing — a network element
 * that answers and clears immediately, or a session that dies mid-verb — and only the
 * pair distinguishes that from a real delivery. `entrega` is DELIVERED only when both
 * hold; see `recordPrerecordedOutcome`.
 *
 * `scriptCompleted` is never a claim that a human listened, only that we played it.
 * It defaults to `false` so a caller that omits it under-claims rather than
 * over-claims delivery.
 *
 * `answeredSeconds` is the answer→hangup duration (0 when unanswered), recorded even
 * when the script did not play — the time on the line is real either way.
 * `scriptDurationSeconds` is the nominal length of the synthesized clip, stored so a
 * future report can compare it against the answered duration.
 */
export const prerecordedCompletionSchema = z.object({
  providerRef: z.string().min(1),
  answered: z.boolean(),
  scriptCompleted: z.boolean().default(false),
  answeredSeconds: z.number().int().nonnegative(),
  scriptDurationSeconds: z.number().int().nonnegative().optional(),
  at: z.string().min(1)
});
export type PrerecordedCompletionInput = z.infer<typeof prerecordedCompletionSchema>;

/**
 * Call-status-tracking-derived completion for a VOICE_AI gestión (see
 * `voice-call-status-tracking`). Used only when the autopilot's own
 * `conversation.started`/`conversation.ended` webhook never fires for the call — most
 * commonly because it was never answered. `answered:false` finalizes `NO_ANSWER`;
 * `answered:true` finalizes `DELIVERED` with a duration recovered from the Fonoster CDR
 * (never fabricated), for the case where the call connected but the autopilot webhook was
 * lost.
 */
export const voiceAiCallStatusCompletionSchema = z.object({
  providerRef: z.string().min(1),
  answered: z.boolean(),
  answeredSeconds: z.number().int().nonnegative(),
  at: z.string().min(1)
});
export type VoiceAiCallStatusCompletionInput = z.infer<typeof voiceAiCallStatusCompletionSchema>;

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
