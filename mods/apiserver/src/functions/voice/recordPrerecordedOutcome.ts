import {
  prerecordedCompletionSchema,
  withErrorHandlingAndValidation,
  type ContactOutcome,
  type PrerecordedCompletionInput
} from "@qcobro/common";

/** Minimal Prisma surface this completion needs. */
export interface PrerecordedOutcomeClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "VOICE_PRERECORDED" };
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

export type RecordPrerecordedOutcomeResult =
  | { matched: false }
  | { matched: true; id: string; outcome: ContactOutcome };

/**
 * Records a PRE-RECORDED call's result onto its gestión, IN-PROCESS (no HTTP callback).
 *
 * The gestión is created at dispatch with `providerRef = callRef` and a placeholder
 * `OTHER` outcome; this enriches that row on completion. `DELIVERED` means the call was
 * ANSWERED — never a claim that the account holder heard the message — and carries the
 * answered `durationSeconds` (the honest signal). Unanswered completions record
 * `NOT_DELIVERED` with zero duration.
 *
 * Idempotent per call ref: once the outcome is finalized (no longer `OTHER`), a repeated
 * completion preserves it and does not downgrade — mirroring `recordOutcomeTx`. Billing
 * settlement is triggered separately (and is itself idempotent via `settledAt`).
 */
export function createRecordPrerecordedOutcome(client: PrerecordedOutcomeClient) {
  const fn = async (input: PrerecordedCompletionInput): Promise<RecordPrerecordedOutcomeResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "VOICE_PRERECORDED" },
      select: { id: true, outcome: true, channelData: true }
    });
    if (!match) return { matched: false };

    const reported: ContactOutcome = input.answered ? "DELIVERED" : "NOT_DELIVERED";
    // Never downgrade a finalized outcome; only the dispatch-time OTHER is replaced.
    const outcome: ContactOutcome = match.outcome === "OTHER" ? reported : match.outcome;

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = {
      ...existing,
      endedAt: new Date(input.at).toISOString()
    };
    if (input.scriptDurationSeconds != null) {
      channelData.scriptDurationSeconds = input.scriptDurationSeconds;
    }

    await client.accountContactLog.update({
      where: { id: match.id },
      data: { outcome, durationSeconds: input.answered ? input.answeredSeconds : 0, channelData }
    });
    return { matched: true, id: match.id, outcome };
  };

  return withErrorHandlingAndValidation(fn, prerecordedCompletionSchema);
}
