import type { AiConfig, InsightGenerator } from "@qcobro/common";
import {
  createGenerateGestionInsight,
  type GenerateInsightClient
} from "./generateGestionInsight.js";
import type { DecideVoiceOutcomeResult } from "./decideVoiceOutcome.js";

export interface CompleteVoiceAiConversationDeps {
  prisma: GenerateInsightClient;
  /** Insight generator (null when AI insights are disabled). */
  generator: InsightGenerator | null;
  /** Generation mode from the `ai` config: insights run here only `onIngestion`. */
  generation: NonNullable<AiConfig>["generation"];
  decideOutcome: (id: string) => Promise<DecideVoiceOutcomeResult>;
}

/**
 * The work a Voz IA gestión is owed once its transcript is stored: the AI insight (when
 * `generation` is `onIngestion`), then the outcome decision. In that order, and a failure of
 * the insight stops the decision, so the gestión stays undecided (`path` null) and the
 * sweep's recovery runs both again. Each step skips work already done (`aiSummary` set,
 * `path` set), so running this twice for one gestión does each step once.
 */
export function createCompleteVoiceAiConversation(deps: CompleteVoiceAiConversationDeps) {
  const generate =
    deps.generation === "onIngestion" && deps.generator
      ? createGenerateGestionInsight({ prisma: deps.prisma, generator: deps.generator })
      : null;

  return async (id: string): Promise<DecideVoiceOutcomeResult> => {
    if (generate) await generate({ id });
    return deps.decideOutcome(id);
  };
}
