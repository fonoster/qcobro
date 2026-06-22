import {
  createAgentTemplateSchema,
  withErrorHandlingAndValidation,
  type AgentTemplateClient,
  type CreateAgentTemplateInput
} from "@qcobro/common";

/**
 * Creates an agent template: a base `AgentTemplate` row plus the one child
 * config row for its channel type, in a single transaction. Type-specific
 * required fields are enforced by the discriminated-union schema.
 */
export function createCreateAgentTemplate(client: AgentTemplateClient, workspaceRef: string) {
  const fn = async (params: CreateAgentTemplateInput) => {
    return client.$transaction(async (tx) => {
      const base = await tx.agentTemplate.create({
        data: {
          workspaceRef,
          name: params.name,
          type: params.type,
          collectionStrategy: params.collectionStrategy
        }
      });

      switch (params.type) {
        case "VOICE_AI":
          await tx.voiceAiConfig.create({
            data: {
              templateId: base.id,
              fonosterAppName: params.fonosterAppName ?? params.name,
              voice: params.voice,
              systemPrompt: params.systemPrompt,
              firstMessage: params.firstMessage,
              language: params.language
            }
          });
          break;
        case "VOICE_PRERECORDED":
          await tx.voicePrerecordedConfig.create({
            data: {
              templateId: base.id,
              fonosterAppName: params.fonosterAppName ?? params.name,
              voice: params.voice,
              script: params.script,
              firstMessage: params.firstMessage,
              language: params.language
            }
          });
          break;
        case "SMS":
          await tx.smsConfig.create({
            data: {
              templateId: base.id,
              messageBody: params.messageBody,
              senderId: params.senderId ?? null
            }
          });
          break;
        case "EMAIL":
          await tx.emailConfig.create({
            data: {
              templateId: base.id,
              subject: params.subject,
              messageBody: params.messageBody,
              fromName: params.fromName,
              fromEmail: params.fromEmail
            }
          });
          break;
        case "WHATSAPP":
          await tx.whatsAppConfig.create({
            data: {
              templateId: base.id,
              templateName: params.templateName,
              messageBody: params.messageBody
            }
          });
          break;
      }

      return base;
    });
  };

  return withErrorHandlingAndValidation(fn, createAgentTemplateSchema);
}
