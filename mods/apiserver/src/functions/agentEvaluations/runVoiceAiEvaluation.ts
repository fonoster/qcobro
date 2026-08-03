import type {
  EvalEvent,
  EvalScenarioSummary,
  VoiceApplicationClient,
  VoiceApplicationEvalScenario
} from "@qcobro/common";
import { buildSyntheticAccountContext } from "./buildSyntheticAccount.js";
import type { ResolvedEvalAgent } from "./resolveEvalTarget.js";

type ResolvedVoiceAgent = Extract<ResolvedEvalAgent, { type: "VOICE_AI" }>;

/**
 * Drives a `VOICE_AI` evaluation via the injected `VoiceApplicationClient` (Fonoster's
 * AUTOPILOT eval machinery in production), relaying its per-turn/per-scenario stream as
 * this capability's `EvalEvent`s and aggregating a run-level summary — Fonoster itself
 * only emits a summary per scenario, not per run (see design.md).
 */
export async function* runVoiceAiEvaluation(
  agent: ResolvedVoiceAgent,
  client: VoiceApplicationClient
): AsyncGenerator<EvalEvent> {
  const scenarios: VoiceApplicationEvalScenario[] = agent.scenarios.map((scenario) => ({
    ref: scenario.ref,
    description: scenario.description,
    account: buildSyntheticAccountContext(scenario.account),
    turns: scenario.turns.map((turn) => ({ input: turn.input, expected: turn.expected }))
  }));

  const turnCounters = new Map<string, number>();
  const scenarioSummaries: EvalScenarioSummary[] = [];

  for await (const event of client.evaluate({
    systemPrompt: agent.systemPrompt,
    firstMessage: agent.firstMessage,
    language: agent.language,
    scenarios
  })) {
    if (event.type === "stepResult") {
      const turnIndex = turnCounters.get(event.scenarioRef) ?? 0;
      turnCounters.set(event.scenarioRef, turnIndex + 1);
      yield {
        type: "turn",
        scenarioRef: event.scenarioRef,
        result: {
          turnIndex,
          input: event.stepResult.humanInput,
          passed: event.stepResult.passed,
          errorMessage: event.stepResult.errorMessage,
          aiResponse: event.stepResult.aiResponse,
          expectedResponse: event.stepResult.expectedResponse,
          evaluationType: event.stepResult.evaluationType,
          toolEvaluations: event.stepResult.toolEvaluations?.map((t) => ({
            expectedTool: t.expectedTool,
            actualTool: t.actualTool,
            passed: t.passed
          }))
        }
      };
    } else if (event.type === "scenarioSummary") {
      scenarioSummaries.push({ ref: event.scenarioRef, overallPassed: event.overallPassed });
      yield {
        type: "scenarioSummary",
        scenarioRef: event.scenarioRef,
        overallPassed: event.overallPassed
      };
    } else {
      yield { type: "error", message: event.message };
    }
  }

  yield {
    type: "summary",
    verdict:
      scenarioSummaries.length > 0 && scenarioSummaries.every((s) => s.overallPassed)
        ? "pass"
        : "fail",
    scenarios: scenarioSummaries
  };
}
