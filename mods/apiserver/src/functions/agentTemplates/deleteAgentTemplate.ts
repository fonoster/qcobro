import {
  deleteAgentTemplateSchema,
  withErrorHandlingAndValidation,
  type AgentTemplateClient,
  type DeleteAgentTemplateInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/**
 * Deletes an agent template. Rejected if the template is still referenced by
 * any non-ARCHIVED campaign — those campaigns depend on it for dispatch.
 */
export function createDeleteAgentTemplate(client: AgentTemplateClient, workspaceRef: string) {
  const fn = async (params: DeleteAgentTemplateInput) => {
    await client.agentTemplate.findFirstOrThrow({ where: { id: params.id, workspaceRef } });

    const activeCampaigns = await client.campaign.count({
      where: { agentTemplateId: params.id, status: { not: "ARCHIVED" } }
    });

    if (activeCampaigns > 0) {
      throw businessError("id", "Cannot delete a template referenced by a non-archived campaign");
    }

    return client.agentTemplate.delete({ where: { id: params.id } });
  };

  return withErrorHandlingAndValidation(fn, deleteAgentTemplateSchema);
}
