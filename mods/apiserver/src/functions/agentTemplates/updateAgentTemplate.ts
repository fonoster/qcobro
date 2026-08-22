import {
  updateAgentTemplateSchema,
  voicePrerecordedDtmfSchema,
  withErrorHandlingAndValidation,
  ValidationError,
  type AgentTemplateClient,
  type AgentType,
  type UpdateAgentTemplateInput,
  type VoiceApplicationClient
} from "@qcobro/common";
import { syncVoiceAiApplication } from "./syncVoiceApplication.js";

const DTMF_FIELDS = [
  "repeatDigit",
  "repeatMessage",
  "maxRepeats",
  "optOutDigit",
  "optOutMessage",
  "optOutConfirmationMessage"
] as const;

/**
 * `updateAgentTemplateSchema.config` is an unvalidated bag (see its docstring) — a patch may
 * touch only one DTMF field (e.g. just `optOutMessage`), so cross-field rules (message
 * required iff its digit is set, digits differ) can only be checked against the *merged*
 * state: the persisted row with the patch applied on top.
 */
function assertValidPrerecordedDtmfPatch(
  existing: {
    repeatDigit: string | null;
    repeatMessage: string | null;
    maxRepeats: number | null;
    optOutDigit: string | null;
    optOutMessage: string | null;
    optOutConfirmationMessage: string | null;
  },
  patch: Record<string, unknown>
): void {
  const touchesDtmf = DTMF_FIELDS.some((f) => f in patch);
  if (!touchesDtmf) return;

  const merged: Record<string, unknown> = {};
  for (const field of DTMF_FIELDS) {
    const value = field in patch ? patch[field] : existing[field];
    if (value !== null && value !== undefined) merged[field] = value;
  }

  const result = voicePrerecordedDtmfSchema.safeParse(merged);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
}

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
      if (existing.type === "VOICE_PRERECORDED") {
        const currentConfig = await client.voicePrerecordedConfig.findUnique({
          where: { templateId: params.id }
        });
        if (currentConfig) {
          assertValidPrerecordedDtmfPatch(currentConfig, params.config);
        }
      }

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
