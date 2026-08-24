import {
  ValidationError,
  evaluateInputSchema,
  type EmailAutopilot,
  type EvalAgentTemplateClient,
  type EvalEvent,
  type TextSimilarityJudge,
  type VoiceApplicationClient
} from "@qcobro/common";
import { resolveEvalTarget } from "./resolveEvalTarget.js";
import { runAutopilotEvaluation } from "./runAutopilotEvaluation.js";
import { runVoiceAiEvaluation } from "./runVoiceAiEvaluation.js";

/**
 * Starts an agent evaluation and streams its events. Returns an async generator, so —
 * unlike every other validated function in this codebase — it cannot be wrapped in
 * `withErrorHandlingAndValidation` (typed `Promise<TResult>`, not a generator); input is
 * validated inline instead, with the same guarantee: invalid input throws a structured
 * `ValidationError` before anything runs.
 */
export function createEvaluateAgent(
  client: EvalAgentTemplateClient,
  workspaceRef: string,
  voiceApplications: VoiceApplicationClient | null,
  emailAutopilot: EmailAutopilot,
  whatsAppAutopilot: EmailAutopilot,
  // Deployment default reply caps — EMAIL's comes from `resend`, WHATSAPP's from
  // `whatsapp`, exactly as the live `ingestEmailReply`/`ingestWhatsAppMessage` paths do.
  emailMaxRepliesDefault: number,
  whatsAppMaxRepliesDefault: number,
  textSimilarityJudge: TextSimilarityJudge
) {
  return async function* evaluateAgent(params: unknown): AsyncGenerator<EvalEvent> {
    const result = evaluateInputSchema.safeParse(params);
    if (!result.success) throw new ValidationError(result.error);

    const agent = await resolveEvalTarget(client, workspaceRef, result.data);

    if (agent.type === "VOICE_AI") {
      if (!voiceApplications) {
        throw new Error("VOICE_AI evaluation requires Fonoster to be configured");
      }
      yield* runVoiceAiEvaluation(agent, voiceApplications);
      return;
    }

    const autopilot = agent.type === "EMAIL" ? emailAutopilot : whatsAppAutopilot;
    const maxRepliesDefault =
      agent.type === "EMAIL" ? emailMaxRepliesDefault : whatsAppMaxRepliesDefault;
    yield* runAutopilotEvaluation(agent, autopilot, maxRepliesDefault, textSimilarityJudge);
  };
}
