import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { AiConfig, EmailAutopilotRequest } from "@qcobro/common";
import { createWhatsAppAutopilot } from "./whatsAppAutopilot.js";
import { createEmailAutopilot } from "./emailAutopilot.js";

const cfg: AiConfig = {
  enabled: true,
  provider: "google",
  model: "gemini-2.5-flash",
  apiKey: "test-key",
  temperature: 0,
  maxTokens: 600,
  generation: "onDemand"
};

const REQ: EmailAutopilotRequest = {
  systemPrompt: "Eres un agente de cobranza amable.",
  thread: [
    {
      direction: "outbound",
      from: "agent",
      at: "",
      subject: "Recordatorio de pago",
      body: "Estimada Ana, su saldo es 5,000."
    },
    { direction: "inbound", from: "+18091230001", at: "", body: "Le pago el viernes." }
  ],
  context: { firstName: "Ana", outstandingBalance: 5000 },
  referenceDate: "2026-06-26"
};

/** Captures the prompt actually sent to the model, which is the only place a prompt-builder
 *  omission is observable — asserting on the request handed to `decide` cannot see it. */
function capturePrompt() {
  const prompts: string[] = [];
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { contents: { parts: { text: string }[] }[] };
    prompts.push(body.contents[0].parts[0].text);
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"action":"ignore"}' }] } }]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof globalThis.fetch;
  return prompts;
}

describe("autopilot prompts carry what the request supplies", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  for (const [channel, create] of [
    ["WHATSAPP", createWhatsAppAutopilot],
    ["EMAIL", createEmailAutopilot]
  ] as const) {
    it(`${channel}: the reference date reaches the model, not just the request`, async () => {
      const prompts = capturePrompt();
      await create(cfg).decide(REQ);

      // Passing `referenceDate` into `decide` is not the same as the prompt builder reading
      // it — WhatsApp's accepted the field and dropped it, so "el viernes" had no anchor and
      // a raw relative phrase could be persisted as a PaymentPromise due date.
      assert.match(prompts[0], /Hoy es 2026-06-26/);
      assert.match(prompts[0], /YYYY-MM-DD/);
    });

    it(`${channel}: the dispatched notice leads the rendered thread`, async () => {
      const prompts = capturePrompt();
      await create(cfg).decide(REQ);

      const hilo = prompts[0].slice(prompts[0].indexOf("Hilo:"));
      assert.ok(
        hilo.indexOf("Estimada Ana, su saldo es 5,000.") < hilo.indexOf("Le pago el viernes."),
        "the notice is rendered before the customer's reply"
      );
    });

    it(`${channel}: omits the date line when no reference date is given`, async () => {
      const prompts = capturePrompt();
      await create(cfg).decide({ ...REQ, referenceDate: undefined });

      assert.doesNotMatch(prompts[0], /Hoy es/);
    });
  }

  it("EMAIL renders a message's subject, which carries real content on the notice", async () => {
    const prompts = capturePrompt();
    await createEmailAutopilot(cfg).decide(REQ);

    assert.match(prompts[0], /asunto: Recordatorio de pago/);
  });
});
