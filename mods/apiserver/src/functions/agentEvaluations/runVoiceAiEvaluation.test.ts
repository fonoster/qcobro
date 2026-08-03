import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  EvalEvent,
  VoiceApplicationClient,
  VoiceApplicationEvalEvent,
  VoiceApplicationEvalInput
} from "@qcobro/common";
import { runVoiceAiEvaluation } from "./runVoiceAiEvaluation.js";
import type { ResolvedEvalAgent } from "./resolveEvalTarget.js";

type ResolvedVoiceAgent = Extract<ResolvedEvalAgent, { type: "VOICE_AI" }>;

function stubVoiceApplications(
  events: VoiceApplicationEvalEvent[],
  capturedInputs: VoiceApplicationEvalInput[] = []
): VoiceApplicationClient {
  return {
    createApplication: async () => ({ ref: "unused" }),
    updateApplication: async () => ({ ref: "unused" }),
    deleteApplication: async () => {},
    async *evaluate(input) {
      capturedInputs.push(input);
      for (const event of events) yield event;
    }
  };
}

async function collect(gen: AsyncGenerator<EvalEvent>): Promise<EvalEvent[]> {
  const out: EvalEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const agent: ResolvedVoiceAgent = {
  type: "VOICE_AI",
  systemPrompt: "Sé amable.",
  language: "es",
  scenarios: [
    {
      ref: "cooperative-debtor",
      account: {
        fullName: "Juan Pérez",
        principalAmount: 25000,
        outstandingBalance: 15000,
        daysPastDue: 0,
        termsAmount: 0,
        termsLength: 0,
        missedInstallments: 0,
        currency: "USD"
      },
      turns: [
        {
          input: "Sí, dígame.",
          expected: { text: { type: "SIMILAR", response: "¿Hablo con el señor Juan Pérez?" } }
        }
      ]
    }
  ]
};

describe("runVoiceAiEvaluation", () => {
  it("relays Fonoster's stepResult as a turn event, assigning sequential turnIndex per scenario", async () => {
    const client = stubVoiceApplications([
      {
        type: "stepResult",
        scenarioRef: "cooperative-debtor",
        stepResult: {
          humanInput: "Sí, dígame.",
          expectedResponse: "¿Hablo con el señor Juan Pérez?",
          aiResponse: "¿Hablo con el señor Juan Pérez?",
          evaluationType: "SIMILAR",
          passed: true
        }
      },
      { type: "scenarioSummary", scenarioRef: "cooperative-debtor", overallPassed: true }
    ]);

    const events = await collect(runVoiceAiEvaluation(agent, client));

    const turn = events.find((e) => e.type === "turn");
    assert.ok(turn && turn.type === "turn");
    assert.equal(turn.result.turnIndex, 0);
    assert.equal(turn.result.passed, true);

    const summary = events.find((e) => e.type === "summary");
    assert.ok(summary && summary.type === "summary");
    assert.equal(summary.verdict, "pass");
  });

  it("aggregates a failing scenario into an overall fail verdict", async () => {
    const client = stubVoiceApplications([
      {
        type: "stepResult",
        scenarioRef: "cooperative-debtor",
        stepResult: {
          humanInput: "Sí, dígame.",
          expectedResponse: "¿Hablo con el señor Juan Pérez?",
          aiResponse: "algo distinto",
          evaluationType: "SIMILAR",
          passed: false
        }
      },
      { type: "scenarioSummary", scenarioRef: "cooperative-debtor", overallPassed: false }
    ]);

    const events = await collect(runVoiceAiEvaluation(agent, client));
    const summary = events.find((e) => e.type === "summary");
    assert.ok(summary && summary.type === "summary");
    assert.equal(summary.verdict, "fail");
  });

  it("relays an evalError as an error event", async () => {
    const client = stubVoiceApplications([{ type: "evalError", message: "boom" }]);
    const events = await collect(runVoiceAiEvaluation(agent, client));
    assert.ok(events.some((e) => e.type === "error" && e.message === "boom"));
  });

  it("passes the rendered account context and scenario turns to the client unchanged", async () => {
    const inputs: VoiceApplicationEvalInput[] = [];
    const client = stubVoiceApplications(
      [{ type: "scenarioSummary", scenarioRef: "cooperative-debtor", overallPassed: true }],
      inputs
    );
    await collect(runVoiceAiEvaluation(agent, client));
    assert.equal(inputs.length, 1);
    assert.equal(inputs[0].systemPrompt, "Sé amable.");
    assert.equal(inputs[0].scenarios[0].turns[0].input, "Sí, dígame.");
    assert.equal(inputs[0].scenarios[0].account.fullName, "Juan Pérez");
  });
});
