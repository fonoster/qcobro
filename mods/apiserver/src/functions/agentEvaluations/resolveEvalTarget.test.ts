import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  type EvalAccountInput,
  type EvalAgentTemplateClient,
  type EvalAgentTemplateRow
} from "@qcobro/common";
import { resolveEvalTarget } from "./resolveEvalTarget.js";

const FULL_ACCOUNT: EvalAccountInput = {
  fullName: "Juan",
  principalAmount: 0,
  outstandingBalance: 0,
  daysPastDue: 0,
  termsAmount: 0,
  termsLength: 0,
  missedInstallments: 0,
  currency: "USD"
};

const SCENARIO_YAML = `
  - ref: promise-to-pay
    account:
      fullName: María López
      principalAmount: 5000
      outstandingBalance: 4200
    turns:
      - input: Sí puedo pagar el viernes
        expected:
          action: reply
`;

function client(row: EvalAgentTemplateRow | null): EvalAgentTemplateClient {
  return {
    agentTemplate: {
      findFirstOrThrow: async () => {
        if (!row) throw new Error("not found");
        return row;
      }
    }
  };
}

function baseRow(over: Partial<EvalAgentTemplateRow> = {}): EvalAgentTemplateRow {
  return {
    id: "at_1",
    type: "SMS",
    voiceAiConfig: null,
    voicePrerecordedConfig: null,
    smsConfig: null,
    emailConfig: null,
    whatsAppConfig: null,
    ...over
  };
}

describe("resolveEvalTarget — existing template", () => {
  it("resolves a VOICE_AI row into a ResolvedEvalAgent", async () => {
    const row = baseRow({
      type: "VOICE_AI",
      voiceAiConfig: { systemPrompt: "Sé amable.", firstMessage: "Buenos días.", language: "es" }
    });
    const agent = await resolveEvalTarget(client(row), "ws_1", {
      agentTemplateId: "at_1",
      scenarios: [
        {
          ref: "s1",
          account: FULL_ACCOUNT,
          turns: [{ input: "hola", expected: { text: { type: "SIMILAR", response: "Hola" } } }]
        }
      ]
    });
    assert.equal(agent.type, "VOICE_AI");
    assert.equal(agent.systemPrompt, "Sé amable.");
  });

  it(
    "rejects a VOICE_AI scenario with a turn missing expected.text — Fonoster's live " +
      "service requires it on every turn, unlike EMAIL/WHATSAPP",
    async () => {
      const row = baseRow({
        type: "VOICE_AI",
        voiceAiConfig: { systemPrompt: "Sé amable.", firstMessage: "Buenos días.", language: "es" }
      });
      await assert.rejects(
        () =>
          resolveEvalTarget(client(row), "ws_1", {
            agentTemplateId: "at_1",
            scenarios: [{ ref: "s1", account: FULL_ACCOUNT, turns: [{ input: "hola" }] }]
          }),
        ValidationError
      );
    }
  );

  it("resolves an EMAIL row into a ResolvedEvalAgent", async () => {
    const row = baseRow({
      type: "EMAIL",
      emailConfig: { systemPrompt: "Autopilot prompt", messageBody: "Hola", maxReplies: 2 }
    });
    const agent = await resolveEvalTarget(client(row), "ws_1", {
      agentTemplateId: "at_1",
      scenarios: [{ ref: "s1", account: FULL_ACCOUNT, turns: [{ input: "hola" }] }]
    });
    assert.equal(agent.type, "EMAIL");
    if (agent.type === "EMAIL" || agent.type === "WHATSAPP") assert.equal(agent.maxReplies, 2);
  });

  it("rejects an SMS template with a structured ValidationError", async () => {
    const row = baseRow({ type: "SMS", smsConfig: { messageBody: "Hola" } });
    await assert.rejects(
      () =>
        resolveEvalTarget(client(row), "ws_1", {
          agentTemplateId: "at_1",
          scenarios: [{ ref: "s1", account: FULL_ACCOUNT, turns: [{ input: "hola" }] }]
        }),
      ValidationError
    );
  });

  it("rejects a VOICE_PRERECORDED template", async () => {
    const row = baseRow({
      type: "VOICE_PRERECORDED",
      voicePrerecordedConfig: { script: "...", language: "es" }
    });
    await assert.rejects(
      () =>
        resolveEvalTarget(client(row), "ws_1", {
          agentTemplateId: "at_1",
          scenarios: [{ ref: "s1", account: FULL_ACCOUNT, turns: [{ input: "hola" }] }]
        }),
      ValidationError
    );
  });
});

describe("resolveEvalTarget — YAML target", () => {
  it("parses and validates a YAML eval template with embedded scenarios", async () => {
    const yaml = `
type: EMAIL
name: Recordatorio
subject: Recordatorio de pago
messageBody: Hola {{firstName}}
systemPrompt: Eres un agente de cobranza amable.
scenarios:${SCENARIO_YAML}
`;
    const agent = await resolveEvalTarget(client(null), "ws_1", { yaml });
    assert.equal(agent.type, "EMAIL");
    assert.equal(agent.scenarios.length, 1);
    assert.equal(agent.scenarios[0].ref, "promise-to-pay");
  });

  it("rejects malformed YAML before any DB access", async () => {
    await assert.rejects(
      () => resolveEvalTarget(client(null), "ws_1", { yaml: "type: [unterminated" }),
      ValidationError
    );
  });

  it("rejects a YAML definition missing a required field (EMAIL without systemPrompt)", async () => {
    const yaml = `
type: EMAIL
name: Recordatorio
subject: Recordatorio de pago
messageBody: Hola {{firstName}}
scenarios:${SCENARIO_YAML}
`;
    await assert.rejects(() => resolveEvalTarget(client(null), "ws_1", { yaml }), ValidationError);
  });

  it("rejects a YAML definition for a static type (SMS has no scenarios to run)", async () => {
    const yaml = `
type: SMS
name: Recordatorio
messageBody: Hola {{firstName}}
scenarios:${SCENARIO_YAML}
`;
    await assert.rejects(() => resolveEvalTarget(client(null), "ws_1", { yaml }), ValidationError);
  });
});
