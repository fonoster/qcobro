import type {
  EmailAutopilot,
  EmailThreadMessage,
  EvalEvent,
  EvalScenarioSummary,
  TextSimilarityJudge
} from "@qcobro/common";
import { buildSyntheticAccountContext } from "./buildSyntheticAccount.js";
import type { ResolvedEvalAgent } from "./resolveEvalTarget.js";

type ResolvedAutopilotAgent = Extract<ResolvedEvalAgent, { type: "EMAIL" | "WHATSAPP" }>;

/**
 * Drives the existing EMAIL/WHATSAPP autopilot decision loop (`EmailAutopilot.decide`,
 * the same pure function `ingestEmailReply`/`ingestWhatsAppMessage` call on a real inbound
 * reply) turn-by-turn over a scenario's scripted inputs, entirely in memory — no gestión,
 * no `PaymentPromise` row, no provider send. WHATSAPP reuses this unmodified, exactly as
 * design.md describes: only the `autopilot` implementation passed in differs.
 *
 * Reply-cap semantics mirror `createIngestEmailReply` exactly: the cap is checked BEFORE
 * calling `decide` (so the decision is always computed), and a `reply` past the cap is
 * downgraded to `escalate` rather than sent.
 */
export async function* runAutopilotEvaluation(
  agent: ResolvedAutopilotAgent,
  autopilot: EmailAutopilot,
  maxRepliesDefault: number,
  textSimilarityJudge: TextSimilarityJudge
): AsyncGenerator<EvalEvent> {
  const cap = Math.min(agent.maxReplies ?? maxRepliesDefault, maxRepliesDefault);
  const scenarioSummaries: EvalScenarioSummary[] = [];
  const referenceDate = new Date().toISOString().slice(0, 10);

  for (const scenario of agent.scenarios) {
    const accountContext = buildSyntheticAccountContext(scenario.account);
    const thread: EmailThreadMessage[] = [];
    let agentReplyCount = 0;
    let scenarioPassed = true;

    for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex++) {
      const turn = scenario.turns[turnIndex];
      thread.push({ direction: "inbound", from: "customer", at: "", body: turn.input });

      const atCap = agentReplyCount >= cap;
      const decision = await autopilot.decide({
        systemPrompt: agent.systemPrompt,
        thread,
        context: accountContext,
        language:
          typeof accountContext.preferredLanguage === "string"
            ? accountContext.preferredLanguage
            : undefined,
        referenceDate
      });

      let action = decision.action;
      if (action === "reply" && atCap) action = "escalate";

      if (action === "reply" && decision.replyBody) {
        thread.push({ direction: "outbound", from: "agent", at: "", body: decision.replyBody });
        agentReplyCount += 1;
      }

      let passed: boolean | undefined;
      let errorMessage: string | undefined;
      if (turn.expected) {
        passed = true;
        if (turn.expected.action && turn.expected.action !== action) {
          passed = false;
          errorMessage = `Expected action "${turn.expected.action}", got "${action}".`;
        }
        if (turn.expected.resultado && turn.expected.resultado !== decision.resultado) {
          passed = false;
          errorMessage = `Expected resultado "${turn.expected.resultado}", got "${decision.resultado ?? "null"}".`;
        }
        if (turn.expected.text) {
          const body = decision.replyBody ?? "";
          if (turn.expected.text.type === "EXACT") {
            if (body !== turn.expected.text.response) {
              passed = false;
              errorMessage = `Expected exact response "${turn.expected.text.response}", but got "${body}".`;
            }
          } else {
            const verdict = await textSimilarityJudge.compare({
              expected: turn.expected.text.response,
              actual: body,
              context: accountContext
            });
            if (!verdict.passed) {
              passed = false;
              errorMessage = verdict.reason ?? `Judge rejected response "${body}".`;
            }
          }
        }
      }
      if (passed === false) scenarioPassed = false;

      yield {
        type: "turn",
        scenarioRef: scenario.ref,
        result: {
          turnIndex,
          input: turn.input,
          passed,
          errorMessage,
          aiResponse: decision.replyBody ?? undefined,
          expectedResponse: turn.expected?.text?.response,
          evaluationType: turn.expected?.text?.type,
          action,
          resultado: decision.resultado ?? null
        }
      };
    }

    scenarioSummaries.push({ ref: scenario.ref, overallPassed: scenarioPassed });
    yield { type: "scenarioSummary", scenarioRef: scenario.ref, overallPassed: scenarioPassed };
  }

  yield {
    type: "summary",
    verdict: scenarioSummaries.every((s) => s.overallPassed) ? "pass" : "fail",
    scenarios: scenarioSummaries
  };
}
