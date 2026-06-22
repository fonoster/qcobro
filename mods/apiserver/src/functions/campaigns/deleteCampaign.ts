import {
  deleteCampaignSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type DeleteCampaignInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/**
 * Deletes a campaign. Only DRAFT campaigns may be deleted — once a campaign has
 * been activated it accrues attempt state and history that must be preserved
 * (operators archive instead).
 */
export function createDeleteCampaign(client: CampaignClient, workspaceRef: string) {
  const fn = async (params: DeleteCampaignInput) => {
    const existing = await client.campaign.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    if (existing.status !== "DRAFT") {
      throw businessError("id", "Only DRAFT campaigns can be deleted");
    }

    return client.campaign.delete({ where: { id: params.id } });
  };

  return withErrorHandlingAndValidation(fn, deleteCampaignSchema);
}
