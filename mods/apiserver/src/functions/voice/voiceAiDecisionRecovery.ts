import { getLogger } from "@fonoster/logger";
import {
  createCompleteVoiceAiConversation,
  type CompleteVoiceAiConversationDeps
} from "./completeVoiceAiConversation.js";
import type { GenerateInsightClient } from "./generateGestionInsight.js";

const logger = getLogger({ service: "voice-decision-recovery", filePath: import.meta.url });

/**
 * How far back the recovery looks, by dispatch time. A call lasts at most an hour and its
 * record is sealed at hangup, so owed work is hours old at most; older undecided gestiones
 * (from before the transcript came from call records) are left alone.
 */
const LOOKBACK_MS = 24 * 60 * 60_000;

/** Minimal Prisma surface the recovery needs, besides the insight's own. */
export interface UndecidedVoiceAiClient {
  accountContactLog: {
    findMany(args: {
      where: {
        agentType: "VOICE_AI";
        path: null;
        contactedAt: { gte: Date };
        channelData: { path: ["transcriptStoredAt"]; string_starts_with: "" };
      };
      select: { id: true; channelData: true };
      take: number;
    }): Promise<{ id: string; channelData: unknown }[]>;
  };
}

export interface VoiceAiDecisionRecoveryDeps extends Omit<
  CompleteVoiceAiConversationDeps,
  "prisma"
> {
  client: UndecidedVoiceAiClient & GenerateInsightClient;
  /**
   * Minutes a stored transcript must be old before the recovery takes it over, so it never
   * races the receiver still running the insight and decision right after storing it.
   */
  graceMinutes: number;
  now: () => Date;
  batchSize?: number;
}

/**
 * The sweep's backstop for work a `200` left owed: a Voz IA gestión whose transcript is
 * stored (`channelData.transcriptStoredAt`) but has no decision (`path` null), because the
 * insight or the decision failed after the receiver answered, or the process stopped. Runs
 * the insight and the decision for each, the same step the receiver runs. Returns how many
 * gestiones it decided.
 */
export function createVoiceAiDecisionRecovery(deps: VoiceAiDecisionRecoveryDeps) {
  const complete = createCompleteVoiceAiConversation({ ...deps, prisma: deps.client });

  return async (): Promise<number> => {
    const now = deps.now().getTime();
    const rows = await deps.client.accountContactLog.findMany({
      where: {
        agentType: "VOICE_AI",
        path: null,
        contactedAt: { gte: new Date(now - LOOKBACK_MS) },
        channelData: { path: ["transcriptStoredAt"], string_starts_with: "" }
      },
      select: { id: true, channelData: true },
      take: deps.batchSize ?? 50
    });

    let decided = 0;
    for (const row of rows) {
      const storedAt = Date.parse(
        String((row.channelData as Record<string, unknown> | null)?.transcriptStoredAt)
      );
      if (!(now - storedAt >= deps.graceMinutes * 60_000)) continue;
      try {
        const result = await complete(row.id);
        if (result.decided) decided++;
      } catch (err) {
        logger.error(
          `voice decision recovery failed id=${row.id}: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    return decided;
  };
}
