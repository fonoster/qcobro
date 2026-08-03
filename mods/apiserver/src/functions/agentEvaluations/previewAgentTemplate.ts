import {
  renderTemplate,
  withErrorHandlingAndValidation,
  previewInputSchema,
  type EvalAgentTemplateClient,
  type PreviewInput
} from "@qcobro/common";
import { buildSyntheticAccountContext } from "./buildSyntheticAccount.js";
import { resolvePreviewTarget } from "./resolvePreviewTarget.js";

/**
 * Renders an `SMS`/`VOICE_PRERECORDED` agent template's message body or script against a
 * sample account context — no conversation, no streaming, no Fonoster/LLM involvement.
 * Accepts either an existing template by id or a not-yet-created YAML definition.
 */
export function createPreviewAgentTemplate(client: EvalAgentTemplateClient, workspaceRef: string) {
  const fn = async (input: PreviewInput): Promise<{ rendered: string }> => {
    const agent = await resolvePreviewTarget(client, workspaceRef, input);
    const context = buildSyntheticAccountContext(input.account);
    const text = agent.type === "SMS" ? agent.messageBody : agent.script;
    return { rendered: renderTemplate(text, context) };
  };

  return withErrorHandlingAndValidation(fn, previewInputSchema);
}
