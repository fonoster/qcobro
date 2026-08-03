import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  EmailAutopilot,
  EmailAutopilotDecision,
  EvalAccountInput,
  EvalEvent
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
  it("reports passed:true when the decision matches expected.action/outcome", async () => {
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
              expected: { action: "reply", outcome: "PAYMENT_PROMISE" }
            }
          ]
        }
      ]
    });
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Gracias, confirmado.", outcome: "PAYMENT_PROMISE" }
    ]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3));

    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.passed, true);
    assert.equal(turn.result.action, "reply");
    assert.equal(turn.result.outcome, "PAYMENT_PROMISE");

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

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3));

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
    const events = await collect(runAutopilotEvaluation(agent(), autopilot, 3));

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

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3));
    const turns = events.filter((e) => e.type === "turn");
    assert.equal(turns.length, 2);
    assert.equal((turns[0] as { result: { action?: string } }).result.action, "reply");
    assert.equal((turns[1] as { result: { action?: string } }).result.action, "escalate");
    assert.equal((turns[1] as { result: { passed?: boolean } }).result.passed, true);
  });

  it("WHATSAPP reuses the exact same runner as EMAIL, unmodified", async () => {
    const a = agent({ type: "WHATSAPP" });
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Perfecto, gracias.", outcome: "PAYMENT_PROMISE" }
    ]);

    const events = await collect(runAutopilotEvaluation(a, autopilot, 3));
    const summary = events.find((e) => e.type === "summary");
    assert.ok(summary && summary.type === "summary");
    assert.equal(summary.verdict, "pass");
  });

  it("never invokes any persistence — the autopilot port has no write method to call", async () => {
    // `EmailAutopilot.decide` is the only dependency the runner takes besides the agent
    // and cap; there is no gestión/PaymentPromise client in scope at all, so a captured
    // outcome can only ever appear in the returned event, never persisted.
    const autopilot = scriptedAutopilot([
      { action: "reply", replyBody: "Gracias.", outcome: "PAYMENT_PROMISE" }
    ]);
    const events = await collect(runAutopilotEvaluation(agent(), autopilot, 3));
    assert.ok(events.some((e) => e.type === "turn" && e.result.outcome === "PAYMENT_PROMISE"));
  });
});
