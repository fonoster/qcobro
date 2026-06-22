import {
  createCampaignSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type CreateCampaignInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/**
 * Creates a campaign plus its portfolio associations in one transaction. The
 * referenced agent template must belong to the active workspace. New campaigns
 * always start in DRAFT.
 */
export function createCreateCampaign(client: CampaignClient, workspaceRef: string) {
  const fn = async (params: CreateCampaignInput) => {
    const template = await client.agentTemplate.findFirst({
      where: { id: params.agentTemplateId, workspaceRef }
    });
    if (!template) {
      throw businessError("agentTemplateId", "Agent template not found in this workspace");
    }

    return client.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          workspaceRef,
          name: params.name,
          agentTemplateId: params.agentTemplateId,
          status: "DRAFT",
          startDate: new Date(params.startDate),
          endDate: params.endDate ? new Date(params.endDate) : null,
          startTime: params.startTime,
          endTime: params.endTime,
          maxAttemptsPerAccount: params.maxAttemptsPerAccount,
          maxAttemptsPerDay: params.maxAttemptsPerDay
        }
      });

      await tx.campaignPortfolio.createMany({
        data: params.portfolioIds.map((portfolioId) => ({
          campaignId: campaign.id,
          portfolioId
        }))
      });

      return campaign;
    });
  };

  return withErrorHandlingAndValidation(fn, createCampaignSchema);
}
