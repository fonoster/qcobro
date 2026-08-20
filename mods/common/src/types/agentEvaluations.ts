import type { AgentType } from "../schemas/agentTemplates.js";
import type { EmailAutopilotAction } from "./email.js";

/**
 * One turn's graded result, streamed as it happens. `passed` is present only when the
 * turn's `expected` was set (see `evalExpectedSchema`) — a turn with no expectation still
 * streams a result, it just has nothing to grade.
 */
export interface EvalStepResult {
  turnIndex: number;
  input: string;
  passed?: boolean;
  errorMessage?: string;
  /** VOICE_AI (relayed from Fonoster's `stepResult`). */
  aiResponse?: string;
  expectedResponse?: string;
  evaluationType?: "EXACT" | "SIMILAR";
  toolEvaluations?: {
    expectedTool: string;
    actualTool?: string;
    passed: boolean;
  }[];
  /** EMAIL/WHATSAPP (the autopilot decision actually taken). */
  action?: EmailAutopilotAction;
  resultado?: string | null;
}

export interface EvalScenarioSummary {
  ref: string;
  overallPassed: boolean;
}

/** One event in the `agentEvaluations.evaluate` stream (see the `agent-evaluations` spec). */
export type EvalEvent =
  | { type: "turn"; scenarioRef: string; result: EvalStepResult }
  | { type: "scenarioSummary"; scenarioRef: string; overallPassed: boolean }
  | { type: "summary"; verdict: "pass" | "fail"; scenarios: EvalScenarioSummary[] }
  | { type: "error"; message: string };

/** The row shape `resolveEvalTarget` needs for an existing agent template — base fields
 * plus every channel's child config (only one is ever non-null per row). */
export interface EvalAgentTemplateRow {
  id: string;
  type: AgentType;
  voiceAiConfig: { systemPrompt: string; firstMessage: string | null; language: string } | null;
  voicePrerecordedConfig: { script: string; language: string } | null;
  smsConfig: { messageBody: string } | null;
  emailConfig: { systemPrompt: string; messageBody: string; maxReplies: number | null } | null;
  whatsAppConfig: { systemPrompt: string; messageBody: string; maxReplies: number | null } | null;
}

/** The narrow read port `resolveEvalTarget`/`resolvePreviewTarget` need from Prisma. */
export interface EvalAgentTemplateClient {
  agentTemplate: {
    findFirstOrThrow(args: {
      where: { id: string; workspaceRef: string };
      include: {
        voiceAiConfig: true;
        voicePrerecordedConfig: true;
        smsConfig: true;
        emailConfig: true;
        whatsAppConfig: true;
      };
    }): Promise<EvalAgentTemplateRow>;
  };
}
