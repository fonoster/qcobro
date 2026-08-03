import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  ValidationError,
  previewYamlAgentSchema,
  type EvalAgentTemplateClient,
  type PreviewInput
} from "@qcobro/common";

export type ResolvedPreviewAgent =
  | { type: "SMS"; messageBody: string }
  | { type: "VOICE_PRERECORDED"; script: string };

function unsupportedType(id: string, type: string) {
  return new ValidationError(
    new z.ZodError([
      {
        code: "custom",
        path: ["agentTemplateId"],
        message:
          `Agent template ${id} is type ${type}; preview only supports SMS/VOICE_PRERECORDED ` +
          `(a static render, no conversation). Use agentEvaluations.evaluate instead.`
      }
    ])
  );
}

/**
 * Resolves an `agentTemplates.preview` target — an existing `SMS`/`VOICE_PRERECORDED`
 * template or a standalone YAML definition of one — into the text to render. Mirrors
 * `resolveEvalTarget`'s shape but for the two static (no-conversation) channel types.
 */
export async function resolvePreviewTarget(
  client: EvalAgentTemplateClient,
  workspaceRef: string,
  input: PreviewInput
): Promise<ResolvedPreviewAgent> {
  if ("yaml" in input) {
    let parsed: unknown;
    try {
      parsed = parseYaml(input.yaml);
    } catch (err) {
      throw new ValidationError(
        new z.ZodError([
          {
            code: "custom",
            path: ["yaml"],
            message: `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`
          }
        ])
      );
    }
    const result = previewYamlAgentSchema.safeParse(parsed);
    if (!result.success) throw new ValidationError(result.error);
    return result.data.type === "SMS"
      ? { type: "SMS", messageBody: result.data.messageBody }
      : { type: "VOICE_PRERECORDED", script: result.data.script };
  }

  const row = await client.agentTemplate.findFirstOrThrow({
    where: { id: input.agentTemplateId, workspaceRef },
    include: {
      voiceAiConfig: true,
      voicePrerecordedConfig: true,
      smsConfig: true,
      emailConfig: true,
      whatsAppConfig: true
    }
  });

  if (row.type === "SMS") {
    if (!row.smsConfig) throw new Error(`Agent template ${row.id} has type SMS but no smsConfig`);
    return { type: "SMS", messageBody: row.smsConfig.messageBody };
  }
  if (row.type === "VOICE_PRERECORDED") {
    if (!row.voicePrerecordedConfig) {
      throw new Error(`Agent template ${row.id} has type VOICE_PRERECORDED but no config`);
    }
    return { type: "VOICE_PRERECORDED", script: row.voicePrerecordedConfig.script };
  }
  throw unsupportedType(row.id, row.type);
}
