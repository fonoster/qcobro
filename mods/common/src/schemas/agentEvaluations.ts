import { z } from "zod";
import { createAgentTemplateSchema } from "./agentTemplates.js";
import { resultadoSchema } from "./contactLog.js";

/**
 * The account context an eval scenario runs against — author-facing fields only
 * (no id/portfolioId/timestamps). The apiserver fills those bookkeeping fields with
 * synthetic values before calling {@link buildOutreachContext}, so eval scenarios reuse
 * the exact same render/context-building logic as a real dispatch, not a re-implementation.
 */
export const evalAccountSchema = z.object({
  fullName: z.string().min(1),
  principalAmount: z.number().default(0),
  outstandingBalance: z.number().default(0),
  daysPastDue: z.number().int().default(0),
  termsAmount: z.number().default(0),
  termsFrequency: z.string().optional(),
  termsLength: z.number().int().default(0),
  missedInstallments: z.number().int().default(0),
  lastPaymentDate: z.string().datetime().optional(),
  lastPaymentAmount: z.number().optional(),
  preferredLanguage: z.string().optional(),
  customerSegment: z.string().optional(),
  bestTimeToCall: z.string().optional(),
  currency: z.string().default("USD")
});
export type EvalAccountInput = z.infer<typeof evalAccountSchema>;

/** VOICE_AI's text-match assertion, mirroring Fonoster's `EXACT`/`SIMILAR` expectation. */
export const evalExpectedTextSchema = z.object({
  type: z.enum(["EXACT", "SIMILAR"]),
  response: z.string().min(1)
});

/** VOICE_AI's expected-tool-call assertion (e.g. `hangup`), mirroring Fonoster's report shape. */
export const evalExpectedToolSchema = z.object({
  tool: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional()
});

/**
 * A single turn's optional expectation. `text`/`tools` are graded for `VOICE_AI` (relayed
 * from Fonoster); `action`/`resultado` are graded for `EMAIL`/`WHATSAPP` (the behavioral analog
 * of an expected tool call — see design.md). A turn with no `expected` still runs and streams
 * a result, it just has nothing to grade — **except for VOICE_AI**: Fonoster's
 * `evaluateIntelligence` requires `expected.text` on every conversation turn (confirmed
 * against the live service, correcting an earlier assumption in design.md), so
 * `resolveEvalTarget` rejects a VOICE_AI scenario with any turn missing it before ever
 * calling Fonoster. The VOICE_AI-specific requirement is enforced at
 * resolution time, not here, since this shape is shared across all three channel types.
 */
export const evalExpectedSchema = z
  .object({
    text: evalExpectedTextSchema.optional(),
    tools: z.array(evalExpectedToolSchema).optional(),
    action: z.enum(["reply", "ignore", "resolve", "escalate"]).optional(),
    resultado: resultadoSchema.optional()
  })
  // Strict so the `outcome` -> `resultado` rename fails loudly. A permissive object would
  // strip an eval suite's legacy `outcome` key, leave the expectation unevaluated, and report
  // every turn as passing - a silently green suite that checks nothing.
  .strict();

export const evalTurnSchema = z.object({
  input: z.string().min(1),
  expected: evalExpectedSchema.optional()
});

export const evalScenarioSchema = z.object({
  ref: z.string().min(1),
  /** Free-text label forwarded as-is to Fonoster's required `scenarios[].description` for
   * VOICE_AI (defaults to `ref` there when omitted); unused by EMAIL/WHATSAPP. */
  description: z.string().optional(),
  account: evalAccountSchema,
  turns: z.array(evalTurnSchema).min(1)
});
export type EvalScenario = z.infer<typeof evalScenarioSchema>;
export type EvalTurn = z.infer<typeof evalTurnSchema>;

// `createAgentTemplateSchema.options` is a tuple in the declaration order
// [VOICE_AI, VOICE_PRERECORDED, SMS, EMAIL, WHATSAPP] — destructured by position (not looked
// up by `.find()`) so TypeScript keeps each member's specific field types instead of widening
// to the full 5-way union. The runtime assertions below catch silent breakage if that
// declaration order ever changes.
const [voiceAiMember, voicePrerecordedMember, smsMember, emailMember, whatsAppMember] =
  createAgentTemplateSchema.options;

function assertMemberType(member: { shape: { type: { value: string } } }, expected: string): void {
  if (member.shape.type.value !== expected) {
    throw new Error(
      `createAgentTemplateSchema member order changed: expected "${expected}" here, got ` +
        `"${member.shape.type.value}". Update the positional destructure in agentEvaluations.ts.`
    );
  }
}
assertMemberType(voiceAiMember, "VOICE_AI");
assertMemberType(voicePrerecordedMember, "VOICE_PRERECORDED");
assertMemberType(smsMember, "SMS");
assertMemberType(emailMember, "EMAIL");
assertMemberType(whatsAppMember, "WHATSAPP");

const evalScenarios = { scenarios: z.array(evalScenarioSchema).min(1) };

/**
 * An eval template: the same fields `createAgentTemplateSchema` validates for
 * `agentTemplates.create`, plus a `scenarios` array — one document is both the agent
 * definition and its tests (see design.md). Restricted to the three conversational
 * channel types; `SMS`/`VOICE_PRERECORDED` have no scenarios to run (see
 * `previewYamlAgentSchema` instead).
 */
export const evalTemplateSchema = z.discriminatedUnion("type", [
  voiceAiMember.extend(evalScenarios),
  emailMember.extend(evalScenarios),
  whatsAppMember.extend(evalScenarios)
]);
export type EvalTemplateInput = z.infer<typeof evalTemplateSchema>;

/** Evaluate an existing template: caller supplies scenarios, since a stored `AgentTemplate`
 * row carries no test fixtures of its own. */
export const evaluateExistingTargetSchema = z.object({
  agentTemplateId: z.string().min(1),
  scenarios: z.array(evalScenarioSchema).min(1)
});

/** Evaluate a not-yet-created agent: the YAML embeds both the agent fields and its scenarios. */
export const evaluateYamlTargetSchema = z.object({
  yaml: z.string().min(1)
});

export const evaluateInputSchema = z.union([
  evaluateExistingTargetSchema,
  evaluateYamlTargetSchema
]);
export type EvaluateExistingInput = z.infer<typeof evaluateExistingTargetSchema>;
export type EvaluateYamlInput = z.infer<typeof evaluateYamlTargetSchema>;
export type EvaluateInput = z.infer<typeof evaluateInputSchema>;

/** A static (no-conversation) agent definition for `agentTemplates.preview`'s YAML target —
 * `createAgentTemplateSchema`'s `SMS`/`VOICE_PRERECORDED` fields, no `scenarios`. */
export const previewYamlAgentSchema = z.discriminatedUnion("type", [
  smsMember,
  voicePrerecordedMember
]);

export const previewExistingTargetSchema = z.object({
  agentTemplateId: z.string().min(1),
  account: evalAccountSchema
});

export const previewYamlTargetSchema = z.object({
  yaml: z.string().min(1),
  account: evalAccountSchema
});

export const previewInputSchema = z.union([previewExistingTargetSchema, previewYamlTargetSchema]);
export type PreviewInput = z.infer<typeof previewInputSchema>;
