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

  const evalInput = {
    systemPrompt: agent.systemPrompt,
    firstMessage: agent.firstMessage,
    language: agent.language,
    scenarios
  };

  const turnCounters = new Map<string, number>();
  const scenarioSummaries: EvalScenarioSummary[] = [];

  // Fonoster's `evaluateIntelligence` intermittently closes its stream cleanly with
  // zero events — no stepResult, no scenarioSummary, no evalError — a known transient
  // cloud-side fault. Re-issue the run once before giving up; a fresh call has always
  // succeeded within seconds.
  let sawAnyEvent = false;
  for (let attempt = 1; attempt <= 2 && !sawAnyEvent; attempt += 1) {
    for await (const event of client.evaluate(evalInput)) {
      sawAnyEvent = true;
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
  }

  // Still nothing after the retry: surface it as an explicit error rather than a
  // legitimate-looking 0/0 fail summary, so the run is diagnosable and re-runnable.
  if (!sawAnyEvent) {
    yield {
      type: "error",
      message:
        "Fonoster returned an empty evaluation stream — no scenarios ran. This is a known " +
        "transient Fonoster fault; re-run the evaluation."
    };
    return;
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
