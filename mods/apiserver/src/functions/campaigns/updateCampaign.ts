import {
  updateCampaignSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type UpdateCampaignInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/**
 * Updates a campaign's mutable fields. `agentTemplateId` is immutable — the
 * `.strict()` schema rejects any attempt to change it. Enforces
 * `endDate > startDate` and `endTime > startTime` against the effective (new or
 * existing) values, since a partial update can invert either pair without the
 * schema ever seeing the unchanged side.
 */
export function createUpdateCampaign(client: CampaignClient, workspaceRef: string) {
  const fn = async (params: UpdateCampaignInput) => {
    const existing = await client.campaign.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    const effStart = params.startDate ? new Date(params.startDate) : existing.startDate;
    const effEnd = params.endDate ? new Date(params.endDate) : existing.endDate;
    if (effEnd && effEnd <= effStart) {
      throw businessError("endDate", "endDate must be after startDate");
    }

    const effStartTime = params.startTime ?? existing.startTime;
    const effEndTime = params.endTime ?? existing.endTime;
    if (effEndTime <= effStartTime) {
      throw businessError("endTime", "endTime must be after startTime");
    }

    const { id, startDate, endDate, ...rest } = params;
    const data: Record<string, unknown> = { ...rest };
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    return client.campaign.update({ where: { id }, data });
  };

  return withErrorHandlingAndValidation(fn, updateCampaignSchema);
}
