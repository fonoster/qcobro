import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  EmailAutopilot,
  EmailAutopilotDecision,
  EvalAccountInput,
  EvalEvent,
  TextSimilarityJudge,
  TextSimilarityRequest,
  TextSimilarityResult
} from "@qcobro/common";
import { runAutopilotEvaluation } from "./runAutopilotEvaluation.js";
import type { ResolvedEvalAgent } from "./resolveEvalTarget.js";

type ResolvedAutopilotAgent = Extract<ResolvedEvalAgent, { type: "EMAIL" | "WHATSAPP" }>;

function account(over: Partial<EvalAccountInput> = {}): EvalAccountInput {
  return {
    fullName: "María López",
    principalAmount: 5000,
    outstandingBalance: 4200,
    daysPastDue: 0,
    termsAmount: 0,
    termsLength: 0,
    missedInstallments: 0,
    currency: "USD",
    ...over
  };
}

function scriptedAutopilot(decisions: EmailAutopilotDecision[]): EmailAutopilot {
  let i = 0;
  return {
    decide: async () => decisions[Math.min(i++, decisions.length - 1)]
  };
}

async function collect(gen: AsyncGenerator<EvalEvent>): Promise<EvalEvent[]> {
  const events: EvalEvent[] = [];
  for await (const event of gen) events.push(event);
  return events;
}

/** A judge that always returns a fixed verdict — the runner never needs a real one. */
function stubJudge(result: TextSimilarityResult = { passed: true }): TextSimilarityJudge {
  return { compare: async () => result };
}

/** A judge that records every request it was asked to compare, for asserting the runner
 * passes the account context through for grounding. */
function recordingJudge(result: TextSimilarityResult): {
  judge: TextSimilarityJudge;
  requests: TextSimilarityRequest[];
} {
  const requests: TextSimilarityRequest[] = [];
  return {
    judge: {
      compare: async (req) => {
        requests.push(req);
        return result;
      }
    },
    requests
  };
}

function agent(over: Partial<ResolvedAutopilotAgent> = {}): ResolvedAutopilotAgent {
  return {
    type: "EMAIL",
    systemPrompt: "Eres un agente de cobranza.",
    scenarios: [
      {
        ref: "promise-to-pay",
        account: account({
          fullName: "María López",
          principalAmount: 5000,
          outstandingBalance: 4200
        }),
        turns: [{ input: "Sí puedo pagar el viernes" }]
      }
    ],
    ...over
  };
}

describe("runAutopilotEvaluation", () => {
  it("reports passed:true when the decision matches expected.action/resultado", async () => {
    const a = agent({
      scenarios: [
        {
          ref: "promise-to-pay",
          account: account({
            fullName: "María López",
            principalAmount: 5000,
            outstandingBalance: 4200
          }),
          turns: [
            {
              input: "Sí puedo pagar el viernes",
              expected: { action: "reply", resultado: "PAYMENT_PROMISE" }
            }
          ]
        }
      ]
    });
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Gracias, confirmado.", resultado: "PAYMENT_PROMISE" }
    ]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3, stubJudge()));

    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.passed, true);
    assert.equal(turn.result.action, "reply");
    assert.equal(turn.result.resultado, "PAYMENT_PROMISE");

    const summary = events.find((e) => e.type === "summary");
    assert.ok(summary && summary.type === "summary");
    assert.equal(summary.verdict, "pass");
  });

  it("reports passed:false when the actual action differs from expected", async () => {
    const a = agent({
      scenarios: [
        {
          ref: "unmet-expectation",
          account: account({
            fullName: "Carlos Ruiz",
            principalAmount: 3000,
            outstandingBalance: 3000
          }),
          turns: [{ input: "no puedo pagar", expected: { action: "resolve" } }]
        }
      ]
    });
    const autopilot = scriptedAutopilot([{ action: "escalate" }]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3, stubJudge()));

    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.passed, false);
    assert.equal(turn.result.action, "escalate");

    const summary = events.find((e) => e.type === "summary");
    assert.ok(summary && summary.type === "summary");
    assert.equal(summary.verdict, "fail");
  });

  it("a turn with no expectation streams a result but grades nothing", async () => {
    const autopilot = scriptedAutopilot([{ action: "reply", replyBody: "Hola" }]);
    const events = await collect(runAutopilotEvaluation(agent(), autopilot, 3, stubJudge()));

    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.passed, undefined);
  });

  it("downgrades a reply past the maxReplies cap to escalate, never producing `reply`", async () => {
    const a = agent({
      maxReplies: 1,
      scenarios: [
        {
          ref: "cap-respected",
          account: account({
            fullName: "Ana Torres",
            principalAmount: 1000,
            outstandingBalance: 1000
          }),
          turns: [
            { input: "no puedo pagar" },
            { input: "otra vez, no puedo", expected: { action: "escalate" } }
          ]
        }
      ]
    });
    // The autopilot itself always "wants" to reply; the cap must downgrade the second one.
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Entiendo, ¿cuándo podría pagar?" },
      { action: "reply", replyBody: "Insisto, necesito una fecha." }
    ]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3, stubJudge()));
    const turns = events.filter((e) => e.type === "turn");
    assert.equal(turns.length, 2);
    assert.equal((turns[0] as { result: { action?: string } }).result.action, "reply");
    assert.equal((turns[1] as { result: { action?: string } }).result.action, "escalate");
    assert.equal((turns[1] as { result: { passed?: boolean } }).result.passed, true);
  });

  it("WHATSAPP reuses the exact same runner as EMAIL, unmodified", async () => {
    const a = agent({ type: "WHATSAPP" });
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Perfecto, gracias.", resultado: "PAYMENT_PROMISE" }
    ]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3, stubJudge()));
    const summary = events.find((e) => e.type === "summary");
    assert.ok(summary && summary.type === "summary");
    assert.equal(summary.verdict, "pass");
  });

  it("expected.text EXACT is a literal match, not judged", async () => {
    const { judge, requests } = recordingJudge({ passed: true });
    const a = agent({
      scenarios: [
        {
          ref: "exact-match",
          account: account(),
          turns: [
            {
              input: "Sí puedo pagar el viernes",
              expected: { action: "reply", text: { type: "EXACT", response: "Gracias." } }
            }
          ]
        }
      ]
    });
    const autopilot = scriptedAutopilot([{ action: "reply", replyBody: "Gracias, confirmado." }]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3, judge));
    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.passed, false);
    assert.match(turn.result.errorMessage ?? "", /exact response/);
    assert.equal(requests.length, 0, "EXACT must not call the judge");
  });

  it("expected.text SIMILAR defers to the judge, and reports its reason on failure", async () => {
    const a = agent({
      scenarios: [
        {
          ref: "hallucinated-account",
          account: account(),
          turns: [
            {
              input: "¿A qué cuenta transfiero?",
              expected: {
                text: {
                  type: "SIMILAR",
                  response: "Le enviaremos las instrucciones de pago por separado."
                }
              }
            }
          ]
        }
      ]
    });
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Transfiera a la cuenta 000-111-222." }
    ]);
    const judge = stubJudge({
      passed: false,
      reason: 'ACTUAL invents an account number ("000-111-222") absent from EXPECTED and CONTEXT.'
    });

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3, judge));
    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.passed, false);
    assert.match(turn.result.errorMessage ?? "", /account number/);
  });

  it("passes the scenario's rendered account context to the judge, for grounding", async () => {
    const { judge, requests } = recordingJudge({ passed: true });
    const a = agent({
      scenarios: [
        {
          ref: "grounded",
          account: account({ fullName: "María López", outstandingBalance: 4200 }),
          turns: [
            {
              input: "¿Cuánto debo?",
              expected: { text: { type: "SIMILAR", response: "Debe $4,200." } }
            }
          ]
        }
      ]
    });
    const autopilot = scriptedAutopilot([{ action: "reply", replyBody: "María, debe $4,200." }]);

    await collect(runAutopilotEvaluation(a, autopilot, 3, judge));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].expected, "Debe $4,200.");
    assert.equal(requests[0].actual, "María, debe $4,200.");
    assert.ok(requests[0].context && Object.keys(requests[0].context).length > 0);
  });

  it("also grounds the judge's context in today's reference date and the customer's own message", async () => {
    // A real stress-test run surfaced a false positive: a customer stated a payment date
    // relatively ("el 15 de septiembre") and the agent echoed it back to confirm the
    // commitment — the judge flagged the resolved date as an invented entity because neither
    // today's date nor the customer's own message were part of its grounding context.
    const { judge, requests } = recordingJudge({ passed: true });
    const a = agent({
      scenarios: [
        {
          ref: "date-grounded",
          account: account(),
          turns: [
            {
              input: "Puedo pagar los $4,200 el 15 de septiembre",
              expected: { text: { type: "SIMILAR", response: "Quedamos en el 15 de septiembre." } }
            }
          ]
        }
      ]
    });
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Perfecto, quedamos en el 15 de septiembre." }
    ]);

    await collect(runAutopilotEvaluation(a, autopilot, 3, judge));
    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].context?.customerMessage,
      "Puedo pagar los $4,200 el 15 de septiembre"
    );
    assert.match(String(requests[0].context?.referenceDate), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("never invokes any persistence — the autopilot port has no write method to call", async () => {
    // `EmailAutopilot.decide` is the only dependency the runner takes besides the agent
    // and cap; there is no gestión/PaymentPromise client in scope at all, so a captured
    // outcome can only ever appear in the returned event, never persisted.
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Gracias.", resultado: "PAYMENT_PROMISE" }
    ]);
    const events = await collect(runAutopilotEvaluation(agent(), autopilot, 3, stubJudge()));
    assert.ok(events.some((e) => e.type === "turn" && e.result.resultado === "PAYMENT_PROMISE"));
  });
});
