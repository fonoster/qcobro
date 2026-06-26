import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError, type EmailAutopilot, type EmailAutopilotDecision } from "@qcobro/common";
import {
  createIngestEmailReply,
  type EmailGestionView,
  type EmailInboundClient
} from "./ingestEmailReply.js";

const TOKEN = "tok-123";
const NOW = () => new Date("2026-06-26T10:00:00Z");

function gestion(over: Partial<EmailGestionView> = {}): EmailGestionView {
  return {
    id: "log-1",
    portfolioAccountId: "acc-1",
    campaignId: "camp-1",
    debtAmountSnapshot: 5000,
    customerEmail: "cliente@example.com",
    channelData: { emailThread: { token: TOKEN, messages: [], agentReplyCount: 0 } },
    agentSystemPrompt: "Eres un agente de cobranza.",
    agentMaxReplies: null,
    accountContext: { customerName: "Ana", outstandingBalance: 5000 },
    ...over
  };
}

function harness(g: EmailGestionView | null, decision: EmailAutopilotDecision) {
  const updates: Record<string, unknown>[] = [];
  const outcomes: Record<string, unknown>[] = [];
  const sends: Record<string, unknown>[] = [];
  const client: EmailInboundClient = {
    loadByProviderRef: async () => g,
    updateChannelData: async (_id, channelData) => {
      updates.push(channelData);
    }
  };
  const autopilot: EmailAutopilot = { decide: async () => decision };
  const deps = {
    client,
    autopilot,
    recordOutcome: async (params: Record<string, unknown>) => {
      outcomes.push(params);
    },
    emailClient: {
      sendEmail: async (input: Record<string, unknown>) => {
        sends.push(input);
        return { id: "sent-1" };
      }
    },
    emailFrom: { email: "cobranza@mikro.do", inboundDomain: "inbound.mikro.do" },
    maxRepliesDefault: 3,
    now: NOW
  };
  return { deps, updates, outcomes, sends };
}

const inbound = (over: Record<string, unknown> = {}) => ({
  from: "cliente@example.com",
  to: [`reply+${TOKEN}@inbound.mikro.do`],
  subject: "Re: Su saldo",
  text: "Puedo pagar el viernes.",
  messageId: "<msg-1@example.com>",
  ...over
});

describe("ingestEmailReply", () => {
  it("correlates, threads the reply, and sends an autopilot reply under the cap", async () => {
    const { deps, updates, sends } = harness(gestion(), {
      action: "reply",
      replyBody: "Gracias, coordinamos el pago."
    });
    const res = await createIngestEmailReply(deps as never)(inbound());

    assert.deepEqual(res, { matched: true, id: "log-1", action: "reply" });
    assert.equal(sends.length, 1, "one reply sent");
    assert.equal(sends[0].to, "cliente@example.com");
    const thread = updates.at(-1)!.emailThread as { messages: unknown[]; agentReplyCount: number };
    assert.equal(thread.messages.length, 2, "inbound + agent reply threaded");
    assert.equal(thread.agentReplyCount, 1);
  });

  it("does not auto-reply once the cap is reached (escalates instead)", async () => {
    const g = gestion({
      agentMaxReplies: 1,
      channelData: { emailThread: { token: TOKEN, messages: [], agentReplyCount: 1 } }
    });
    const { deps, sends } = harness(g, { action: "reply", replyBody: "otra respuesta" });
    const res = await createIngestEmailReply(deps as never)(inbound());

    assert.equal((res as { action: string }).action, "escalate");
    assert.equal(sends.length, 0, "no reply sent past the cap");
  });

  it("captures an outcome + objective via recordOutcome", async () => {
    const { deps, outcomes } = harness(gestion(), {
      action: "reply",
      replyBody: "Registramos su compromiso.",
      outcome: "PAYMENT_PROMISE",
      objective: { type: "PAYMENT_PROMISE", amount: 500, dueDate: "2026-07-01" }
    });
    await createIngestEmailReply(deps as never)(inbound());

    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].outcome, "PAYMENT_PROMISE");
    assert.equal(outcomes[0].providerRef, TOKEN);
    assert.deepEqual(outcomes[0].intentMetadata, {
      promisedAmount: 500,
      promisedDate: "2026-07-01"
    });
  });

  it("ignores auto-replies without counting against the cap", async () => {
    const { deps, sends } = harness(gestion(), {
      action: "reply",
      replyBody: "no debería enviarse"
    });
    const res = await createIngestEmailReply(deps as never)(
      inbound({ headers: { "Auto-Submitted": "auto-replied" } })
    );

    assert.equal((res as { action: string }).action, "ignore");
    assert.equal(sends.length, 0);
  });

  it("returns matched:false for an unknown token", async () => {
    const { deps } = harness(null, { action: "ignore" });
    const res = await createIngestEmailReply(deps as never)(inbound());
    assert.deepEqual(res, { matched: false });
  });

  it("rejects a malformed inbound payload (validation-failure)", async () => {
    const { deps, sends } = harness(gestion(), { action: "ignore" });
    await assert.rejects(
      () => createIngestEmailReply(deps as never)(inbound({ from: "" }) as never),
      (err) => err instanceof ValidationError
    );
    assert.equal(sends.length, 0, "side effect never fired on invalid input");
  });
});
