import {
  updateAgentTemplateSchema,
  withErrorHandlingAndValidation,
  type AgentTemplateClient,
  type AgentType,
  type UpdateAgentTemplateInput
} from "@qcobro/common";

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
export function createUpdateAgentTemplate(client: AgentTemplateClient, workspaceRef: string) {
  const fn = async (params: UpdateAgentTemplateInput) => {
    const existing = await client.agentTemplate.findFirstOrThrow({
      where: { id: params.id, workspaceRef }
    });

    const baseData: Record<string, unknown> = {};
    if (params.name !== undefined) baseData.name = params.name;
    if (params.collectionStrategy !== undefined) {
      baseData.collectionStrategy = params.collectionStrategy;
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

    return updated;
  };

  return withErrorHandlingAndValidation(fn, updateAgentTemplateSchema);
}
