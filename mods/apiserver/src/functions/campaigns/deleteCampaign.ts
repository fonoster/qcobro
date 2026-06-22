import {
  deleteCampaignSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type DeleteCampaignInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/**
 * Deletes a campaign, but only while it has no recorded outreach attempts. Once a
 * campaign has accrued attempt state and history it must be preserved (operators
 * archive instead). Deletion is independent of status — deletability keys off
 * recorded progress only.
 */
export function createDeleteCampaign(client: CampaignClient, workspaceRef: string) {
  const fn = async (params: DeleteCampaignInput) => {
    await client.campaign.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    const attempted = await client.campaignAccountState.count({
      where: { campaignId: params.id, attemptCount: { gt: 0 } }
    });
    if (attempted > 0) {
      throw businessError(
        "id",
        "Cannot delete a campaign with recorded attempts; archive it instead"
      );
    }

    return client.campaign.delete({ where: { id: params.id } });
  };

  return withErrorHandlingAndValidation(fn, deleteCampaignSchema);
}
