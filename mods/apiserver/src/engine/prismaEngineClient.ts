import type { PrismaClient } from "@prisma/client";
import type { EngineCampaign, EngineCandidate, EngineClient } from "./engine.js";

/**
 * The engine's read surface backed by Prisma. The engine runs across ALL workspaces
 * (it is not workspace-scoped like the tRPC procedures), so these queries filter by
 * status/portfolio, not by `workspaceRef`.
 */
export function createPrismaEngineClient(prisma: PrismaClient): EngineClient {
  return {
    async listActiveCampaigns(): Promise<EngineCampaign[]> {
      const rows = await prisma.campaign.findMany({
        where: { status: "ACTIVE" },
        include: {
          agentTemplate: {
            include: { voiceAiConfig: true, voicePrerecordedConfig: true, smsConfig: true }
          },
          portfolios: { select: { portfolioId: true } }
        },
        orderBy: { createdAt: "asc" }
      });

      return rows.map((c) => ({
        id: c.id,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        daysOfWeek: c.daysOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
        maxAttemptsPerAccount: c.maxAttemptsPerAccount,
        maxAttemptsPerDay: c.maxAttemptsPerDay,
        agentTemplate: c.agentTemplate
          ? {
              type: c.agentTemplate.type,
              voiceAiConfig: c.agentTemplate.voiceAiConfig
                ? {
                    fonosterAppRef: c.agentTemplate.voiceAiConfig.fonosterAppRef,
                    systemPrompt: c.agentTemplate.voiceAiConfig.systemPrompt,
                    firstMessage: c.agentTemplate.voiceAiConfig.firstMessage
                  }
                : null,
              voicePrerecordedConfig: c.agentTemplate.voicePrerecordedConfig
                ? {
                    fonosterAppRef: c.agentTemplate.voicePrerecordedConfig.fonosterAppRef,
                    script: c.agentTemplate.voicePrerecordedConfig.script
                  }
                : null,
              smsConfig: c.agentTemplate.smsConfig
                ? { messageBody: c.agentTemplate.smsConfig.messageBody }
                : null
            }
          : null,
        portfolios: c.portfolios
      }));
    },

    async listCandidates(campaignId: string, portfolioIds: string[]): Promise<EngineCandidate[]> {
      if (portfolioIds.length === 0) return [];
      const rows = await prisma.portfolioAccount.findMany({
        where: { portfolioId: { in: portfolioIds }, archivedAt: null },
        include: {
          portfolio: { select: { currency: true } },
          campaignStates: { where: { campaignId } }
        }
      });
      return rows.map((a) => ({
        id: a.id,
        phone: a.phone,
        intentStatus: a.intentStatus,
        suppressUntil: a.suppressUntil,
        outstandingBalance: a.outstandingBalance,
        fullName: a.fullName,
        portfolio: { currency: a.portfolio.currency },
        campaignStates: a.campaignStates.map((s) => ({
          attemptCount: s.attemptCount,
          attemptsToday: s.attemptsToday,
          lastAttemptAt: s.lastAttemptAt,
          suppressUntil: s.suppressUntil
        }))
      })) as EngineCandidate[];
    },

    async completeCampaign(id: string): Promise<void> {
      await prisma.campaign.update({ where: { id }, data: { status: "COMPLETED" } });
    }
  };
}
