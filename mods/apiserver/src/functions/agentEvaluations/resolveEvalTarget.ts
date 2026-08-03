import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  ValidationError,
  evalTemplateSchema,
  type EvalAgentTemplateClient,
  type EvalAgentTemplateRow,
  type EvalScenario,
  type EvalTemplateInput,
  type EvaluateInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";

/** An agent + its scenarios, normalized from either an existing template row or a
 * validated YAML eval template — the shape the VOICE_AI/EMAIL/WHATSAPP runners consume. */
export type ResolvedEvalAgent =
  | {
      type: "VOICE_AI";
      systemPrompt: string;
      firstMessage?: string;
      language: string;
      scenarios: EvalScenario[];
    }
  | {
      type: "EMAIL" | "WHATSAPP";
      systemPrompt: string;
      maxReplies?: number;
      scenarios: EvalScenario[];
    };

/** Parses a YAML eval template string, throwing a {@link ValidationError} for both
 * malformed YAML and schema violations — never a raw parse exception. */
function parseEvalTemplateYaml(yaml: string) {
  let parsed: unknown;
  try {
    parsed = parseYaml(yaml);
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
  const result = evalTemplateSchema.safeParse(parsed);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

/**
 * Fonoster's `evaluateIntelligence` requires `expected.text` on every conversation turn —
 * confirmed against the live service, correcting design.md's earlier assumption that VOICE_AI
 * turns could omit `expected` like EMAIL/WHATSAPP turns can. Rejecting this upfront (rather
 * than letting Fonoster's request validation fail deep inside the stream) gives the caller a
 * clear, field-level error before any Fonoster call is made.
 */
function assertVoiceAiTurnsHaveExpectedText(scenarios: EvalScenario[]): void {
  scenarios.forEach((scenario) => {
    scenario.turns.forEach((turn, index) => {
      if (!turn.expected?.text) {
        throw businessError(
          `scenarios.${scenario.ref}.turns.${index}.expected.text`,
          `VOICE_AI evaluation requires expected.text on every turn (Fonoster grades each ` +
            `turn against it) — scenario "${scenario.ref}" turn ${index} has none.`
        );
      }
    });
  });
}

/** Narrows a template row to the three conversational channel types. */
function isConversationalRow(
  row: EvalAgentTemplateRow
): row is EvalAgentTemplateRow & { type: "VOICE_AI" | "EMAIL" | "WHATSAPP" } {
  return row.type === "VOICE_AI" || row.type === "EMAIL" || row.type === "WHATSAPP";
}

/** Normalizes an existing template row (child config nested under `voiceAiConfig`/
 * `emailConfig`/`whatsAppConfig`) — `row.type` must already be narrowed to a conversational
 * type by the caller. */
function normalizeRow(
  row: EvalAgentTemplateRow & { type: "VOICE_AI" | "EMAIL" | "WHATSAPP" },
  scenarios: EvalScenario[]
): ResolvedEvalAgent {
  if (row.type === "VOICE_AI") {
    if (!row.voiceAiConfig)
      throw new Error(`Agent template has type VOICE_AI but no voiceAiConfig`);
    return {
      type: "VOICE_AI",
      systemPrompt: row.voiceAiConfig.systemPrompt,
      firstMessage: row.voiceAiConfig.firstMessage ?? undefined,
      language: row.voiceAiConfig.language,
      scenarios
    };
  }
  const config = row.type === "EMAIL" ? row.emailConfig : row.whatsAppConfig;
  if (!config) throw new Error(`Agent template has type ${row.type} but no matching config`);
  return {
    type: row.type,
    systemPrompt: config.systemPrompt,
    maxReplies: config.maxReplies ?? undefined,
    scenarios
  };
}

/** Normalizes a validated YAML eval template — fields are flat on the object itself (the
 * same shape `createAgentTemplateSchema` validates), not nested under a child config. */
function normalizeTemplate(template: EvalTemplateInput): ResolvedEvalAgent {
  if (template.type === "VOICE_AI") {
    return {
      type: "VOICE_AI",
      systemPrompt: template.systemPrompt,
      firstMessage: template.firstMessage,
      language: template.language,
      scenarios: template.scenarios
    };
  }
  return {
    type: template.type,
    systemPrompt: template.systemPrompt,
    maxReplies: template.maxReplies,
    scenarios: template.scenarios
  };
}

/**
 * Resolves an `agentEvaluations.evaluate` target — an existing agent template (fetched
 * workspace-scoped, cross-workspace ids rejected the same way `agentTemplates.get` does)
 * or a YAML eval template (parsed, validated, held ephemeral, never persisted) — into the
 * agent + scenarios the VOICE_AI/EMAIL/WHATSAPP runners consume. Only the three
 * conversational channel types are valid; `SMS`/`VOICE_PRERECORDED` templates are rejected
 * (they have no conversation — see `agentTemplates.preview` instead).
 */
export async function resolveEvalTarget(
  client: EvalAgentTemplateClient,
  workspaceRef: string,
  input: EvaluateInput
): Promise<ResolvedEvalAgent> {
  if ("yaml" in input) {
    const resolved = normalizeTemplate(parseEvalTemplateYaml(input.yaml));
    if (resolved.type === "VOICE_AI") assertVoiceAiTurnsHaveExpectedText(resolved.scenarios);
    return resolved;
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

  if (!isConversationalRow(row)) {
    throw new ValidationError(
      new z.ZodError([
        {
          code: "custom",
          path: ["agentTemplateId"],
          message:
            `Agent template ${row.id} is type ${row.type}, which has no conversation to ` +
            `evaluate. Use agentTemplates.preview instead.`
        }
      ])
    );
  }

  const resolved = normalizeRow(row, input.scenarios);
  if (resolved.type === "VOICE_AI") assertVoiceAiTurnsHaveExpectedText(resolved.scenarios);
  return resolved;
}
