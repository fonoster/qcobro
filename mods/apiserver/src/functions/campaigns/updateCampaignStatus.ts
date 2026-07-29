import {
  updateCampaignStatusSchema,
  campaignStatusTransitions,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type UpdateCampaignStatusInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/**
 * Changes a campaign's status, enforcing the valid-transition map. New campaigns start
 * ACTIVE; the lifecycle is ACTIVE ⇄ PAUSED → COMPLETED → ARCHIVED (ARCHIVED terminal).
 * Status is changed only here — never through the general update path.
 */
export function createUpdateCampaignStatus(client: CampaignClient, workspaceRef: string) {
  const fn = async (params: UpdateCampaignStatusInput) => {
    const existing = await client.campaign.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    if (params.status === existing.status) {
      return existing;
    }

    const allowed = campaignStatusTransitions[existing.status];
    if (!allowed.includes(params.status)) {
      throw businessError(
        "status",
        `Cannot change status from ${existing.status} to ${params.status}`
      );
    }

    return client.campaign.update({
      where: { id: params.id },
      data: {
        status: params.status,
        // The operator-driven route always means a manual pause; pauseReason is
        // cleared whenever the campaign leaves PAUSED (to any other status).
        pauseReason: params.status === "PAUSED" ? "MANUAL" : null
      }
    });
  };

  return withErrorHandlingAndValidation(fn, updateCampaignStatusSchema);
}
