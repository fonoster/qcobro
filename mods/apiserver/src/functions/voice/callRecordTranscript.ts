import type { VoiceCallRecord } from "@qcobro/common";

/**
 * The spoken turns of a Fonoster call record, in dialog order, as a chat history: each
 * `text` entry's `originator` indexes into `vcon.parties`, whose role is `caller` (the
 * customer → `human`) or `agent` (our Voz IA app → `ai`). Entries from any other party and
 * empty turns are skipped. A record with no text turns yields `[]`.
 */
export function chatHistoryFromCallRecord(record: VoiceCallRecord): Record<string, string>[] {
  const parties = record.vcon.parties ?? [];
  const turns: Record<string, string>[] = [];
  for (const entry of record.vcon.dialog ?? []) {
    if (entry.type !== "text" || typeof entry.body !== "string" || !entry.body.trim()) continue;
    const role = typeof entry.originator === "number" ? parties[entry.originator]?.role : undefined;
    if (role === "caller") turns.push({ human: entry.body });
    else if (role === "agent") turns.push({ ai: entry.body });
  }
  return turns;
}

/**
 * Whether the record's redacted copy carries a recording: a `recording` dialog entry, and no
 * `fonoster.recordingWithheld` (set when a redaction could not be beeped out of the audio).
 */
export function callRecordHasRecording(record: VoiceCallRecord): boolean {
  if (record.vcon.fonoster?.recordingWithheld) return false;
  return (record.vcon.dialog ?? []).some((entry) => entry.type === "recording");
}
