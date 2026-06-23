import {
  generateInsightInputSchema,
  withErrorHandlingAndValidation,
  type GenerateInsightInput,
  type GestionInsight,
  type InsightGenerator,
  type TranscriptLine
} from "@qcobro/common";

/** Minimal Prisma surface this needs. */
export interface GenerateInsightClient {
  accountContactLog: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        aiSummary: true;
        channelData: true;
        portfolioAccount: {
          select: { fullName: true; outstandingBalance: true; preferredLanguage: true };
        };
      };
    }): Promise<{
      id: string;
      aiSummary: string | null;
      channelData: unknown;
      portfolioAccount: {
        fullName: string;
        outstandingBalance: number;
        preferredLanguage: string | null;
      };
    } | null>;
    update(args: { where: { id: string }; data: Partial<GestionInsight> }): Promise<unknown>;
  };
}

export type GenerateInsightResult =
  | { generated: false; reason: "disabled" | "not_found" | "no_transcript" | "cached" }
  | { generated: true; insight: GestionInsight };

/**
 * Generates and persists a gestión's AI analysis from its transcript.
 *
 * No-ops (without calling the LLM) when: insights are disabled (`generator` null),
 * the gestión is missing, it has no transcript, or it was already analyzed
 * (`aiSummary` present — the cache marker). Advisory only: it writes the `ai*`
 * fields and never touches `outcome` or objectives.
 */
export function createGenerateGestionInsight(deps: {
  prisma: GenerateInsightClient;
  generator: InsightGenerator | null;
}) {
  const fn = async (input: GenerateInsightInput): Promise<GenerateInsightResult> => {
    if (!deps.generator) return { generated: false, reason: "disabled" };

    const log = await deps.prisma.accountContactLog.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        aiSummary: true,
        channelData: true,
        portfolioAccount: {
          select: { fullName: true, outstandingBalance: true, preferredLanguage: true }
        }
      }
    });
    if (!log) return { generated: false, reason: "not_found" };
    if (log.aiSummary) return { generated: false, reason: "cached" };

    const transcript = (log.channelData as { transcript?: TranscriptLine[] } | null)?.transcript;
    if (!transcript || transcript.length === 0)
      return { generated: false, reason: "no_transcript" };

    const insight = await deps.generator.analyze({
      transcript,
      language: log.portfolioAccount.preferredLanguage ?? undefined,
      context: {
        customerName: log.portfolioAccount.fullName,
        outstandingBalance: log.portfolioAccount.outstandingBalance
      }
    });

    await deps.prisma.accountContactLog.update({
      where: { id: log.id },
      data: {
        aiSummary: insight.aiSummary,
        aiSentiment: insight.aiSentiment,
        aiDebtReason: insight.aiDebtReason,
        aiResult: insight.aiResult,
        aiNextStep: insight.aiNextStep
      }
    });
    return { generated: true, insight };
  };

  return withErrorHandlingAndValidation(fn, generateInsightInputSchema);
}
