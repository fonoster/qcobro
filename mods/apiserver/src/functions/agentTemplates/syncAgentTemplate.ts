import {
  syncAgentTemplateSchema,
  withErrorHandlingAndValidation,
  type AgentTemplateClient,
  type SyncAgentTemplateInput,
  type VoiceApplicationClient
} from "@qcobro/common";
import { syncVoiceAiApplication } from "./syncVoiceApplication.js";

/**
 * Manually re-attempts the Fonoster sync for a voice template (the console's
 * "re-sync" action). Unlike create/update, sync failures propagate here so the
 * operator sees the error. Only VOICE_AI is synced this pass; other types and an
 * unconfigured Fonoster are no-ops that return the template unchanged.
 */
export function createSyncAgentTemplate(
  client: AgentTemplateClient,
  workspaceRef: string,
  voiceApplications?: VoiceApplicationClient | null
) {
  const fn = async (params: SyncAgentTemplateInput) => {
    const template = await client.agentTemplate.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    if (template.type === "VOICE_AI" && voiceApplications) {
      await syncVoiceAiApplication(client, voiceApplications, template.id);
    }

    return template;
  };

  return withErrorHandlingAndValidation(fn, syncAgentTemplateSchema);
}
