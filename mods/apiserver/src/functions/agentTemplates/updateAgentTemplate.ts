import {
  updateAgentTemplateSchema,
  withErrorHandlingAndValidation,
  type AgentTemplateClient,
  type AgentType,
  type UpdateAgentTemplateInput,
  type VoiceApplicationClient
} from "@qcobro/common";
import { syncVoiceAiApplication } from "./syncVoiceApplication.js";

function childDelegate(client: AgentTemplateClient, type: AgentType) {
  switch (type) {
    case "VOICE_AI":
      return client.voiceAiConfig;
    case "VOICE_PRERECORDED":
      return client.voicePrerecordedConfig;
    case "SMS":
      return client.smsConfig;
    case "EMAIL":
      return client.emailConfig;
    case "WHATSAPP":
      return client.whatsAppConfig;
  }
}

/**
 * Updates an agent template's mutable base fields and, if a `config` bag is
 * supplied, its type-specific child row. The template `type` is immutable —
 * the `.strict()` schema rejects any attempt to change it.
 */
export function createUpdateAgentTemplate(
  client: AgentTemplateClient,
  workspaceRef: string,
  voiceApplications?: VoiceApplicationClient | null
) {
  const fn = async (params: UpdateAgentTemplateInput) => {
    const existing = await client.agentTemplate.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    const baseData: Record<string, unknown> = {};
    if (params.name !== undefined) baseData.name = params.name;
    // Translate the `archived` toggle into an archivedAt timestamp (or clear it).
    if (params.archived !== undefined) {
      baseData.archivedAt = params.archived ? new Date() : null;
    }

    const updated = await client.agentTemplate.update({
      where: { id: params.id },
      data: baseData
    });

    if (params.config && Object.keys(params.config).length > 0) {
      await childDelegate(client, existing.type).update({
        where: { templateId: params.id },
        data: params.config
      });
    }

    // Re-sync VOICE_AI to Fonoster after a config/name change (best-effort).
    if (existing.type === "VOICE_AI" && voiceApplications) {
      try {
        await syncVoiceAiApplication(client, voiceApplications, params.id);
      } catch {
        // Saved locally; the operator can re-sync manually.
      }
    }

    return updated;
  };

  return withErrorHandlingAndValidation(fn, updateAgentTemplateSchema);
}
