import type {
  EmailAutopilot,
  EmailThreadMessage,
  EvalEvent,
  EvalScenarioSummary
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
  maxRepliesDefault: number
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
      if (turn.expected) {
        passed = true;
        if (turn.expected.action && turn.expected.action !== action) passed = false;
        if (turn.expected.outcome && turn.expected.outcome !== decision.outcome) passed = false;
        if (turn.expected.text) {
          const body = decision.replyBody ?? "";
          const ok =
            turn.expected.text.type === "EXACT"
              ? body === turn.expected.text.response
              : body.toLowerCase().includes(turn.expected.text.response.toLowerCase());
          if (!ok) passed = false;
        }
      }
      if (passed === false) scenarioPassed = false;

      yield {
        type: "turn",
        scenarioRef: scenario.ref,
        result: { turnIndex, input: turn.input, passed, action, outcome: decision.outcome ?? null }
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
