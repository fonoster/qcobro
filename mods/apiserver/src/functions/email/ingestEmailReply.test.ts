import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  type EmailAutopilot,
  type EmailAutopilotDecision,
  type EmailThreadMessage
} from "@qcobro/common";
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
    workspaceTimezone: "America/Santo_Domingo",
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
  const decideReqs: Record<string, unknown>[] = [];
  const autopilot: EmailAutopilot = {
    decide: async (req) => {
      decideReqs.push(req as unknown as Record<string, unknown>);
      return decision;
    }
  };
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
    emailFrom: { email: "cobranza@demo.do", inboundDomain: "inbound.demo.do" },
    maxRepliesDefault: 3,
    now: NOW
  };
  return { deps, updates, outcomes, sends, decideReqs };
}

const inbound = (over: Record<string, unknown> = {}) => ({
  from: "cliente@example.com",
  to: [`reply+${TOKEN}@inbound.demo.do`],
  subject: "Re: Su saldo",
  text: "Puedo pagar el viernes.",
  messageId: "<msg-1@example.com>",
  ...over
});

describe("ingestEmailReply", () => {
  it("correlates, threads the reply, sends an autopilot reply under the cap, and records delivery/path", async () => {
    const { deps, outcomes, sends, decideReqs } = harness(gestion(), {
      action: "reply",
      replyBody: "Gracias, coordinamos el pago."
    });
    const res = await createIngestEmailReply(deps as never)(inbound());

    assert.deepEqual(res, { matched: true, id: "log-1", action: "reply" });
    assert.equal(sends.length, 1, "one reply sent");
    assert.equal(sends[0].to, "cliente@example.com");
    // The autopilot gets today's date so it can resolve relative promises ("el viernes").
    assert.equal(decideReqs[0].referenceDate, "2026-06-26");
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].delivery, "DELIVERED");
    assert.equal(outcomes[0].path, "ENGAGED");
    assert.equal(outcomes[0].outcome, undefined);
    const channelData = outcomes[0].channelData as Record<string, unknown>;
    const thread = channelData.emailThread as { messages: unknown[]; agentReplyCount: number };
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
      objective: { amount: 500, dueDate: "2026-07-01" }
    });
    await createIngestEmailReply(deps as never)(inbound());

    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].outcome, "PAYMENT_PROMISE");
    assert.equal(outcomes[0].delivery, "DELIVERED");
    assert.equal(outcomes[0].path, "ENGAGED");
    assert.equal(outcomes[0].providerRef, TOKEN);
    assert.deepEqual(outcomes[0].intentMetadata, {
      promisedAmount: 500,
      promisedDate: "2026-07-01"
    });
  });

  it("collapses an unrecognized outcome string (e.g. a removed OTHER/WRONG_NUMBER) to null", async () => {
    const { deps, outcomes } = harness(gestion(), {
      action: "resolve",
      outcome: "OTHER"
    });
    await createIngestEmailReply(deps as never)(inbound());

    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].outcome, undefined);
    assert.equal(outcomes[0].delivery, "DELIVERED");
    assert.equal(outcomes[0].path, "ENGAGED");
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

// ── The dispatched notice ─────────────────────────────────────────────────────
//
// A real gestión carries the notice as flat `channelData` fields written at dispatch; the
// `emailThread` key only appears once a reply arrives. These use that dispatch-shaped
// fixture rather than the pre-seeded empty thread above.

const NOTICE = "Estimada Ana, su saldo es 5,000. Escríbanos por WhatsApp: wa.me/18095550000";

const dispatched = (over: Partial<EmailGestionView> = {}) =>
  gestion({
    channelData: {
      from: "cobranza@demo.do",
      to: "cliente@example.com",
      subject: "Recordatorio de pago",
      messageBody: NOTICE
    },
    ...over
  });

describe("ingestEmailReply — the dispatched notice in the autopilot's view", () => {
  it("leads the thread with the notice, so the agent sees what the customer is replying to", async () => {
    const { deps, decideReqs } = harness(dispatched(), { action: "ignore" });
    await createIngestEmailReply(deps as never)(inbound({ text: "¿De qué trata esto?" }));

    const thread = decideReqs[0].thread as EmailThreadMessage[];
    assert.equal(thread.length, 2);
    assert.equal(thread[0].direction, "outbound");
    assert.equal(thread[0].body, NOTICE);
    assert.equal(thread[0].subject, "Recordatorio de pago");
    assert.equal(thread[1].body, "¿De qué trata esto?");
  });

  it("keeps the notice out of the persisted thread — channelData.messageBody stays its only home", async () => {
    const { deps, outcomes } = harness(dispatched(), { action: "ignore" });
    await createIngestEmailReply(deps as never)(inbound());

    const channelData = outcomes[0].channelData as Record<string, unknown>;
    const thread = channelData.emailThread as { messages: EmailThreadMessage[] };
    assert.equal(thread.messages.length, 1, "only the inbound reply is stored");
    assert.equal(thread.messages[0].direction, "inbound");
    assert.equal(channelData.messageBody, NOTICE);
  });

  it("replies under the subject we sent when the customer's reply carries none", async () => {
    const { deps, sends } = harness(dispatched(), { action: "reply", replyBody: "Con gusto." });
    await createIngestEmailReply(deps as never)(inbound({ subject: undefined }));

    assert.equal(sends[0].subject, "Re: Recordatorio de pago");
  });

  it("treats an empty inbound subject as absent, not as a subject", async () => {
    // `inboundEmailSchema` types subject as optional, so a reply carrying `Subject:` with an
    // empty value parses as "" — which `??` would keep, sending a bare "Re:".
    const { deps, sends } = harness(dispatched(), { action: "reply", replyBody: "Con gusto." });
    await createIngestEmailReply(deps as never)(inbound({ subject: "" }));

    assert.equal(sends[0].subject, "Re: Recordatorio de pago");
  });

  it("dates the conversation by the workspace's calendar day, not UTC's", async () => {
    // 00:30 UTC on the 27th is still 20:30 on the 26th in Santo Domingo (UTC−4). Taking the
    // UTC date would resolve "mañana" a day early and mis-date the PaymentPromise.
    const { deps, decideReqs } = harness(dispatched(), { action: "ignore" });
    deps.now = () => new Date("2026-06-27T00:30:00Z");
    await createIngestEmailReply(deps as never)(inbound());

    assert.equal(decideReqs[0].referenceDate, "2026-06-26");
  });

  it("presents the whole conversation on every turn, with the notice always first", async () => {
    // One gestión carried across three inbound replies, exactly as production does: each
    // call persists the thread, and the next reply loads it back.
    const g = dispatched();
    const seen: EmailThreadMessage[][] = [];

    for (const [i, text] of ["¿De qué trata?", "¿Cuánto debo?", "Pago el viernes."].entries()) {
      const { deps, outcomes, decideReqs } = harness(g, {
        action: "reply",
        replyBody: `respuesta ${i + 1}`
      });
      await createIngestEmailReply(deps as never)(inbound({ text, subject: undefined }));
      seen.push(decideReqs[0].thread as EmailThreadMessage[]);
      g.channelData = outcomes[0].channelData as Record<string, unknown>;
    }

    // Turn 1 sees notice + 1 reply; turn 2 adds that agent reply + the 2nd; and so on.
    assert.deepEqual(
      seen.map((t) => t.length),
      [2, 4, 6]
    );
    for (const thread of seen) {
      assert.equal(thread[0].body, NOTICE, "notice stays at index 0");
    }
    // Nothing from an earlier turn is dropped as the thread grows.
    assert.deepEqual(
      seen[2].map((m) => m.body),
      [NOTICE, "¿De qué trata?", "respuesta 1", "¿Cuánto debo?", "respuesta 2", "Pago el viernes."]
    );
  });

  it("is inert for a gestión with no stored notice", async () => {
    const { deps, decideReqs } = harness(gestion(), { action: "ignore" });
    await createIngestEmailReply(deps as never)(inbound());

    const thread = decideReqs[0].thread as EmailThreadMessage[];
    assert.equal(thread.length, 1);
    assert.equal(thread[0].direction, "inbound");
  });
});
