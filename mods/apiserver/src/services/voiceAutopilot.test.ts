import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { AiConfig } from "@qcobro/common";
import { createVoiceAutopilot, transcriptToThread } from "./voiceAutopilot.js";

const BASE_REQ = {
  systemPrompt: "Eres un agente de cobranza amable.",
  context: { firstName: "Ana", outstandingBalance: 500 }
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("transcriptToThread", () => {
  it("maps customer/agent roles onto inbound/outbound thread messages", () => {
    const thread = transcriptToThread([
      { role: "agent", text: "Le llamamos por su saldo pendiente." },
      { role: "customer", text: "Puedo pagar el viernes." }
    ]);
    assert.deepEqual(thread, [
      { direction: "outbound", from: "agent", at: "", body: "Le llamamos por su saldo pendiente." },
      { direction: "inbound", from: "customer", at: "", body: "Puedo pagar el viernes." }
    ]);
  });

  it("returns an empty thread for an empty transcript", () => {
    assert.deepEqual(transcriptToThread([]), []);
  });
});

describe("createVoiceAutopilot — mock provider (no AI configured)", () => {
  const autopilot = createVoiceAutopilot(undefined);

  it("resolves with PAYMENT_PROMISE when the customer states an intent to pay", async () => {
    const decision = await autopilot.decide({
      ...BASE_REQ,
      thread: transcriptToThread([
        { role: "agent", text: "Le llamamos por su saldo." },
        { role: "customer", text: "Puedo pagar el viernes." }
      ])
    });
    assert.equal(decision.action, "resolve");
    assert.equal(decision.outcome, "PAYMENT_PROMISE");
  });

  it("resolves with WRONG_NUMBER when the customer denies being the debtor", async () => {
    const decision = await autopilot.decide({
      ...BASE_REQ,
      thread: transcriptToThread([{ role: "customer", text: "No soy yo, número equivocado." }])
    });
    assert.equal(decision.action, "resolve");
    assert.equal(decision.outcome, "WRONG_NUMBER");
  });

  it("escalates on a complaint/dispute, carrying no outcome", async () => {
    const decision = await autopilot.decide({
      ...BASE_REQ,
      thread: transcriptToThread([
        { role: "customer", text: "Voy a poner una queja con mi abogado." }
      ])
    });
    assert.equal(decision.action, "escalate");
    assert.equal(decision.outcome, undefined);
  });

  it("resolves with no outcome when nothing notable happened", async () => {
    const decision = await autopilot.decide({
      ...BASE_REQ,
      thread: transcriptToThread([{ role: "customer", text: "¿Cuál es mi saldo?" }])
    });
    assert.equal(decision.action, "resolve");
    assert.equal(decision.outcome, undefined);
  });

  it("does not throw on an empty transcript", async () => {
    const decision = await autopilot.decide({ ...BASE_REQ, thread: [] });
    assert.equal(decision.action, "resolve");
    assert.equal(decision.outcome, undefined);
  });
});

describe("createVoiceAutopilot — google provider", () => {
  const originalFetch = globalThis.fetch;
  const cfg: AiConfig = {
    enabled: true,
    provider: "google",
    model: "gemini-2.5-flash",
    apiKey: "test-key",
    temperature: 0,
    maxTokens: 600,
    generation: "onDemand"
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses a fenced ```json response", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(200, {
        candidates: [
          {
            content: {
              parts: [
                {
                  text:
                    '```json\n{"action":"resolve","outcome":"PAYMENT_PROMISE",' +
                    '"objective":{"amount":500,"dueDate":"2026-08-01"}}\n```'
                }
              ]
            }
          }
        ]
      })) as typeof fetch;

    const autopilot = createVoiceAutopilot(cfg);
    const decision = await autopilot.decide({
      ...BASE_REQ,
      thread: transcriptToThread([{ role: "customer", text: "Puedo pagar 500 el 1 de agosto." }])
    });
    assert.equal(decision.outcome, "PAYMENT_PROMISE");
    assert.equal(decision.objective?.amount, 500);
  });

  it("parses an unfenced JSON response", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: '{"action":"escalate"}' }] } }]
      })) as typeof fetch;

    const autopilot = createVoiceAutopilot(cfg);
    const decision = await autopilot.decide({ ...BASE_REQ, thread: [] });
    assert.equal(decision.action, "escalate");
  });

  it("throws when the model response carries no JSON object", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: "no puedo ayudar con eso" }] } }]
      })) as typeof fetch;

    const autopilot = createVoiceAutopilot(cfg);
    await assert.rejects(() => autopilot.decide({ ...BASE_REQ, thread: [] }));
  });
});
