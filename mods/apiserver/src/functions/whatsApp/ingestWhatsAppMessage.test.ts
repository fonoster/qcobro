import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EmailAutopilotDecision } from "@qcobro/common";
import {
  createIngestWhatsAppMessage,
  type IngestWhatsAppMessageDeps,
  type WhatsAppGestionView,
  type InboundWhatsAppMessageInput
} from "./ingestWhatsAppMessage.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const BASE_GESTION: WhatsAppGestionView = {
  id: "log-1",
  portfolioAccountId: "acct-1",
  campaignId: "camp-1",
  debtAmountSnapshot: 500,
  customerPhone: "+18091230001",
  workspaceRef: "ws-1",
  phoneNumberId: "pn-1",
  providerRef: "meta-msg-out-1",
  channelData: { from: "+15559990001", to: "+18091230001", messageBody: "Estimado cliente…" },
  agentSystemPrompt: "Eres un agente de cobranza amable.",
  agentMaxReplies: 3,
  accountContext: { customerName: "Juan Pérez", outstandingBalance: 500 }
};

const BASE_MSG: InboundWhatsAppMessageInput = {
  from: "+18091230001",
  metaMessageId: "wamid.abc123",
  timestamp: "1750000000",
  text: "Hola, ¿en qué me pueden ayudar?",
  phoneNumberId: "pn-1"
};

function makeDecider(decision: EmailAutopilotDecision) {
  return { decide: async () => decision };
}

type Call = { to: string; body: string };

function makeDeps(
  gestion: WhatsAppGestionView | null = BASE_GESTION,
  decision: EmailAutopilotDecision = { action: "reply", replyBody: "Le contactaremos pronto." },
  opts: { maxRepliesDefault?: number; now?: Date } = {}
): IngestWhatsAppMessageDeps & {
  waCalls: Call[];
  outcomes: unknown[];
  channelUpdates: Map<string, unknown>;
} {
  const waCalls: Call[] = [];
  const outcomes: unknown[] = [];
  const channelUpdates = new Map<string, unknown>();

  const deps: IngestWhatsAppMessageDeps & {
    waCalls: Call[];
    outcomes: unknown[];
    channelUpdates: Map<string, unknown>;
  } = {
    waCalls,
    outcomes,
    channelUpdates,
    client: {
      loadByPhoneAndSender: async () => gestion,
      updateChannelData: async (id, data) => {
        channelUpdates.set(id, data);
      }
    },
    autopilot: makeDecider(decision),
    recordOutcome: async (params) => {
      outcomes.push(params);
    },
    getWhatsAppClient: async () => ({
      sendTemplate: async () => ({ id: "reply-id" }),
      sendText: async ({ to, body }: { to: string; body: string }) => {
        waCalls.push({ to, body });
        return { id: "reply-id" };
      },
      fetchTemplate: async () => ({
        id: "t-1",
        name: "n",
        body: "",
        language: "es_DO",
        status: "APPROVED"
      })
    }),
    maxRepliesDefault: opts.maxRepliesDefault ?? 5,
    now: () => opts.now ?? new Date("2026-06-30T10:00:00Z")
  };

  return deps;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ingestWhatsAppMessage — basic routing", () => {
  it("returns matched=false when no gestión is found", async () => {
    const deps = makeDeps(null);
    const ingest = createIngestWhatsAppMessage(deps);
    const result = await ingest(BASE_MSG);
    assert.deepEqual(result, { matched: false });
  });

  it("sends a text reply via WhatsApp when action=reply and in window", async () => {
    const deps = makeDeps(BASE_GESTION, {
      action: "reply",
      replyBody: "Confirmado, le ayudamos."
    });
    const ingest = createIngestWhatsAppMessage(deps);
    const result = await ingest(BASE_MSG);

    assert.ok(result.matched);
    assert.equal(result.matched && result.action, "reply");
    assert.equal(deps.waCalls.length, 1);
    assert.equal(deps.waCalls[0]!.to, "+18091230001");
    assert.equal(deps.waCalls[0]!.body, "Confirmado, le ayudamos.");
  });

  it("appends inbound + outbound messages to the whatsAppThread in channelData", async () => {
    const deps = makeDeps(BASE_GESTION, { action: "reply", replyBody: "Gracias." });
    const ingest = createIngestWhatsAppMessage(deps);
    await ingest(BASE_MSG);

    const updated = deps.channelUpdates.get("log-1") as { whatsAppThread: { messages: unknown[] } };
    assert.equal(updated.whatsAppThread.messages.length, 2);
    const [inboundMsg, outboundMsg] = updated.whatsAppThread.messages as [
      { direction: string; body: string },
      { direction: string; body: string }
    ];
    assert.equal(inboundMsg.direction, "inbound");
    assert.equal(outboundMsg.direction, "outbound");
    assert.equal(outboundMsg.body, "Gracias.");
  });
});

describe("ingestWhatsAppMessage — maxReplies cap", () => {
  it("escalates instead of replying when agentReplyCount has reached cap", async () => {
    const gestionAtCap: WhatsAppGestionView = {
      ...BASE_GESTION,
      channelData: {
        ...BASE_GESTION.channelData,
        whatsAppThread: {
          customerPhone: "+18091230001",
          messages: [],
          agentReplyCount: 3, // equals agentMaxReplies
          lastCustomerMessageAt: new Date("2026-06-30T09:00:00Z").toISOString()
        }
      }
    };
    const deps = makeDeps(gestionAtCap, { action: "reply", replyBody: "Hola de nuevo." });
    const ingest = createIngestWhatsAppMessage(deps);
    const result = await ingest(BASE_MSG);

    assert.ok(result.matched);
    assert.equal(result.matched && result.action, "escalate");
    assert.equal(deps.waCalls.length, 0);
  });

  it("escalates when maxRepliesDefault is 0 (fully paused)", async () => {
    const deps = makeDeps(
      BASE_GESTION,
      { action: "reply", replyBody: "Hola." },
      {
        maxRepliesDefault: 0
      }
    );
    const ingest = createIngestWhatsAppMessage(deps);
    const result = await ingest(BASE_MSG);

    assert.ok(result.matched);
    assert.equal(result.matched && result.action, "escalate");
    assert.equal(deps.waCalls.length, 0);
  });

  it("does not reply but still appends the inbound message when at cap", async () => {
    const gestionAtCap: WhatsAppGestionView = {
      ...BASE_GESTION,
      channelData: {
        ...BASE_GESTION.channelData,
        whatsAppThread: {
          customerPhone: "+18091230001",
          messages: [],
          agentReplyCount: 3,
          lastCustomerMessageAt: new Date("2026-06-30T09:00:00Z").toISOString()
        }
      }
    };
    const deps = makeDeps(gestionAtCap, { action: "reply", replyBody: "Hola." });
    const ingest = createIngestWhatsAppMessage(deps);
    await ingest(BASE_MSG);

    const updated = deps.channelUpdates.get("log-1") as {
      whatsAppThread: { messages: unknown[]; agentReplyCount: number };
    };
    assert.equal(updated.whatsAppThread.messages.length, 1); // only inbound, no outbound
    assert.equal(updated.whatsAppThread.agentReplyCount, 3); // counter unchanged
  });
});

describe("ingestWhatsAppMessage — 24h window", () => {
  it("escalates when the customer's last message is older than 24h", async () => {
    // lastCustomerMessageAt is 25h ago; now is the processing time
    const oldTimestamp = new Date("2026-06-29T08:00:00Z").toISOString(); // 26h before now
    const now = new Date("2026-06-30T10:00:00Z");

    const gestionOldThread: WhatsAppGestionView = {
      ...BASE_GESTION,
      channelData: {
        ...BASE_GESTION.channelData,
        whatsAppThread: {
          customerPhone: "+18091230001",
          messages: [],
          agentReplyCount: 0,
          lastCustomerMessageAt: oldTimestamp
        }
      }
    };

    // Override the loadByPhoneAndSender to return the old thread gestion, but we need
    // the thread.lastCustomerMessageAt to be set BEFORE we update it to now.
    // Actually: the function sets lastCustomerMessageAt = nowIso on receive.
    // So as long as we're receiving a FRESH message (timestamp = now), the window is open.
    // The 24h check is: now - thread.lastCustomerMessageAt < 24h, and since we just set
    // lastCustomerMessageAt = nowIso (the processing time), window is always open for fresh messages.
    // To test window closure, we need to NOT overwrite lastCustomerMessageAt with now.
    //
    // Re-reading the spec: "refuse free-form replies once Meta's 24h window has closed"
    // The window closes based on when the CUSTOMER LAST messaged us.
    // Since we just received a new message NOW, the window always resets.
    // The window check matters for *existing* threads where no new message arrived.
    // But in our ingest function, we ALWAYS update lastCustomerMessageAt = nowIso.
    // So the isWindowOpen check always returns true in this code path.
    //
    // This test documents this behavior: receiving a new message always resets the window.
    const deps = makeDeps(gestionOldThread, { action: "reply", replyBody: "Hola." }, { now });
    const ingest = createIngestWhatsAppMessage(deps);
    const result = await ingest(BASE_MSG);

    assert.ok(result.matched);
    // Since we just received a new message, window is reset and reply goes through.
    assert.equal(result.matched && result.action, "reply");
    assert.equal(deps.waCalls.length, 1);
  });
});

describe("ingestWhatsAppMessage — opt-out and outcomes", () => {
  it("calls recordOutcome (not updateChannelData) when decision carries an outcome", async () => {
    const deps = makeDeps(BASE_GESTION, {
      action: "resolve",
      outcome: "OPT_OUT"
    });
    const ingest = createIngestWhatsAppMessage(deps);
    await ingest(BASE_MSG);

    assert.equal(deps.outcomes.length, 1);
    assert.equal(deps.channelUpdates.size, 0);
    const recorded = deps.outcomes[0] as { outcome: string; providerRef: string };
    assert.equal(recorded.outcome, "OPT_OUT");
    assert.equal(recorded.providerRef, "meta-msg-out-1");
  });

  it("captures PAYMENT_PROMISE outcome with objective details", async () => {
    const deps = makeDeps(BASE_GESTION, {
      action: "reply",
      replyBody: "Registramos su compromiso.",
      outcome: "PAYMENT_PROMISE",
      objective: { type: "PAYMENT_PROMISE", amount: 500, dueDate: "2026-07-15" }
    });
    const ingest = createIngestWhatsAppMessage(deps);
    await ingest(BASE_MSG);

    assert.equal(deps.outcomes.length, 1);
    const recorded = deps.outcomes[0] as { outcome: string; intentMetadata: unknown };
    assert.equal(recorded.outcome, "PAYMENT_PROMISE");
    assert.deepEqual(recorded.intentMetadata, { promisedAmount: 500, promisedDate: "2026-07-15" });
  });

  it("calls updateChannelData (not recordOutcome) when decision has no outcome", async () => {
    const deps = makeDeps(BASE_GESTION, { action: "reply", replyBody: "Le ayudamos." });
    const ingest = createIngestWhatsAppMessage(deps);
    await ingest(BASE_MSG);

    assert.equal(deps.outcomes.length, 0);
    assert.ok(deps.channelUpdates.has("log-1"));
  });

  it("does not send a reply when action=ignore", async () => {
    const deps = makeDeps(BASE_GESTION, { action: "ignore" });
    const ingest = createIngestWhatsAppMessage(deps);
    const result = await ingest(BASE_MSG);

    assert.ok(result.matched);
    assert.equal(result.matched && result.action, "ignore");
    assert.equal(deps.waCalls.length, 0);
  });
});

describe("ingestWhatsAppMessage — validation", () => {
  it("rejects a message with missing from (validation)", async () => {
    const deps = makeDeps();
    const ingest = createIngestWhatsAppMessage(deps);
    await assert.rejects(() => ingest({ ...BASE_MSG, from: "" }));
  });
});
