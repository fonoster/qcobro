import { z } from "zod";

/**
 * The envelope of a Fonoster workspace webhook delivery (`POST /api/voice/events`). Fonoster
 * signs the raw body; the receiver checks that before parsing it. `data` depends on `type`
 * and is parsed with the matching schema below; any other `type` is acknowledged and ignored.
 */
export const fonosterWebhookEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.string().min(1),
  workspaceRef: z.string().min(1),
  data: z.record(z.string(), z.unknown())
});
export type FonosterWebhookEvent = z.infer<typeof fonosterWebhookEventSchema>;

/** `call.ended`: the call reached an app and hung up. */
export const callEndedDataSchema = z.object({
  callRef: z.string().min(1),
  durationSeconds: z.number().int().nonnegative()
});

/** `call.failed`: the call never reached an app (busy, no answer, rejected, …). */
export const callFailedDataSchema = z.object({
  callRef: z.string().min(1),
  reason: z.string().min(1)
});

/** `call_record.sealed`: a version of the call's record was sealed (version 1 at hangup). */
export const callRecordSealedDataSchema = z.object({
  callRef: z.string().min(1),
  version: z.number().int().positive()
});

/**
 * A raw chat-history entry: `{ ai: text }` (our agent) or `{ human: text }` (the customer).
 * Kept permissive — only the ai/human keys are read.
 */
export const voiceChatMessageSchema = z.record(z.string(), z.unknown());

/** A Voz IA call's transcript, taken from its call record, stored on its gestión. */
export const voiceTranscriptInputSchema = z.object({
  callRef: z.string().min(1),
  chatHistory: z.array(voiceChatMessageSchema)
});
export type VoiceTranscriptInput = z.infer<typeof voiceTranscriptInputSchema>;

/**
 * In-process completion signal for a PRE-RECORDED call, reported by the co-located
 * VoiceServer (not an HTTP callback like Voz IA).
 *
 * `answered` and `scriptCompleted` are two different facts and both are needed:
 * `answered` says the callee picked up, `scriptCompleted` says the message actually
 * played out to the end. A call can be answered and play nothing — a network element
 * that answers and clears immediately, or a session that dies mid-verb — and only the
 * pair distinguishes that from a real delivery. `delivery` is DELIVERED only when both
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
 *
 * `recordingFile` is the name Fonoster recorded the call under, derived from the voice
 * request (see `recordingFileNameForCall`). It is kept for reference only: the console
 * plays recordings from the call record (`GET /api/gestiones/:id/recording`).
 */
export const prerecordedCompletionSchema = z.object({
  providerRef: z.string().min(1),
  answered: z.boolean(),
  scriptCompleted: z.boolean().default(false),
  answeredSeconds: z.number().int().nonnegative(),
  scriptDurationSeconds: z.number().int().nonnegative().optional(),
  recordingFile: z.string().min(1).optional(),
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

/** Normalize a chat history into ordered console transcript lines. */
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
