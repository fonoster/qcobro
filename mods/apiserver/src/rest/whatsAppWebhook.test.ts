import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import { createWhatsAppWebhookHandlers } from "./whatsAppWebhook.js";
import type { PrismaClient } from "@prisma/client";

// ── Stub DB ──────────────────────────────────────────────────────────────────

interface SenderRow {
  workspaceRef: string;
  qualityRating: string | null;
}

interface LogRow {
  id: string;
  portfolioAccountId: string;
  entrega?: string;
  deliveryReason?: string | null;
  resultado?: string | null;
  channelData?: Record<string, unknown> | null;
}

/** A gestión as it looks right after dispatch, before any status has landed. */
function dispatchedLog(overrides: Partial<LogRow> = {}): LogRow {
  return {
    id: "log-1",
    portfolioAccountId: "acct-1",
    entrega: "DISPATCHED",
    deliveryReason: null,
    resultado: null,
    channelData: null,
    ...overrides
  };
}

function makeDb(opts: {
  integrationVerifyToken?: string;
  senders?: Record<string, SenderRow>;
  logs?: Record<string, LogRow>;
}) {
  const senders: Record<string, SenderRow> = opts.senders ?? {};
  const logs: Record<string, LogRow> = opts.logs ?? {};

  return {
    whatsAppIntegration: {
      findFirst: async ({ where }: { where: { verifyToken: string } }) =>
        where.verifyToken === opts.integrationVerifyToken ? { workspaceRef: "ws-test" } : null
    },
    whatsAppSenderNumber: {
      findUnique: async ({ where }: { where: { phoneNumberId: string } }) =>
        senders[where.phoneNumberId] ?? null,
      update: async ({
        where,
        data
      }: {
        where: { phoneNumberId: string };
        data: { qualityRating: string };
      }) => {
        if (!senders[where.phoneNumberId]) throw new Error("sender not found");
        senders[where.phoneNumberId]!.qualityRating = data.qualityRating;
        return senders[where.phoneNumberId];
      }
    },
    accountContactLog: {
      findFirst: async ({ where }: { where: { providerRef: string; agentType?: string } }) => {
        const row = logs[where.providerRef];
        // The recorder scopes its lookup to the channel; an SMS row with a colliding ref
        // must not be picked up here.
        if (!row || (where.agentType && where.agentType !== "WHATSAPP")) return null;
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<LogRow> }) => {
        const row = Object.values(logs).find((l) => l.id === where.id);
        if (!row) throw new Error("gestión not found");
        // Mirror Prisma: only the keys actually present in `data` are written.
        Object.assign(row, data);
        return row;
      }
    }
  } as unknown as PrismaClient;
}

// ── Request/Response stubs ────────────────────────────────────────────────────

function makeRes() {
  let code = 0;
  let responseBody: unknown = null;

  const res = {
    status(c: number) {
      code = c;
      return this;
    },
    json(b: unknown) {
      responseBody = b;
      return this;
    },
    send(b: unknown) {
      responseBody = b;
      return this;
    }
  } as unknown as Response;

  return {
    res,
    code: () => code,
    body: () => responseBody
  };
}

function makeReq(opts: {
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  rawBody?: string;
}) {
  return {
    query: opts.query ?? {},
    body: opts.body ?? {},
    headers: opts.headers ?? {},
    rawBody: opts.rawBody
  } as unknown as Request;
}

function sign(secret: string, payload: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

// ── Webhook body helpers ───────────────────────────────────────────────────────

function messagesBody(phoneNumberId: string, statuses: unknown[] = [], messages: unknown[] = []) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "+15550001111", phone_number_id: phoneNumberId },
              statuses,
              messages
            }
          }
        ]
      }
    ]
  };
}

function qualityBody(phoneNumberId: string, newRating: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "quality_rating",
            value: {
              display_phone_number: "+15550001111",
              phone_number_id: phoneNumberId,
              event: "FLAGGED",
              new_quality_rating: newRating,
              previous_quality_rating: "GREEN"
            }
          }
        ]
      }
    ]
  };
}

// Give the async processEvents a tick to finish after the 200 is sent.
function drain() {
  return new Promise((r) => setImmediate(r));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("whatsAppWebhook.verify", () => {
  it("echoes hub.challenge when verify_token matches a workspace", async () => {
    const db = makeDb({ integrationVerifyToken: "tok-abc" });
    const { verify } = createWhatsAppWebhookHandlers(db, {});

    const req = makeReq({
      query: { "hub.mode": "subscribe", "hub.verify_token": "tok-abc", "hub.challenge": "12345" }
    });
    const { res, code, body } = makeRes();
    await verify(req, res);

    assert.equal(code(), 200);
    assert.equal(body(), "12345");
  });

  it("returns 403 when the verify_token is unknown", async () => {
    const db = makeDb({ integrationVerifyToken: "tok-abc" });
    const { verify } = createWhatsAppWebhookHandlers(db, {});

    const req = makeReq({
      query: { "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "x" }
    });
    const { res, code } = makeRes();
    await verify(req, res);

    assert.equal(code(), 403);
  });

  it("returns 400 when hub.mode is not subscribe", async () => {
    const db = makeDb({});
    const { verify } = createWhatsAppWebhookHandlers(db, {});

    const req = makeReq({
      query: { "hub.mode": "unsubscribe", "hub.verify_token": "tok", "hub.challenge": "x" }
    });
    const { res, code } = makeRes();
    await verify(req, res);

    assert.equal(code(), 400);
  });
});

describe("whatsAppWebhook.events — signature", () => {
  it("rejects a request with a bad signature when appSecret is set", async () => {
    const db = makeDb({});
    const { events } = createWhatsAppWebhookHandlers(db, { appSecret: "secret-key" });

    const payload = JSON.stringify({ object: "whatsapp_business_account" });
    const req = makeReq({
      body: JSON.parse(payload),
      rawBody: payload,
      headers: { "x-hub-signature-256": "sha256=deadbeef" }
    });
    const { res, code } = makeRes();
    await events(req, res);

    assert.equal(code(), 401);
  });

  it("accepts a request with a valid signature", async () => {
    const db = makeDb({});
    const secret = "my-app-secret";
    const { events } = createWhatsAppWebhookHandlers(db, { appSecret: secret });

    const payload = JSON.stringify(messagesBody("pn-1"));
    const sig = sign(secret, payload);
    const req = makeReq({
      body: JSON.parse(payload),
      rawBody: payload,
      headers: { "x-hub-signature-256": sig }
    });
    const { res, code, body } = makeRes();
    await events(req, res);

    assert.equal(code(), 200);
    assert.equal(body(), "EVENT_RECEIVED");
  });
});

describe("whatsAppWebhook.events — delivery statuses", () => {
  it("advances entrega to DELIVERED on a delivered status", async () => {
    const logs = { "msg-id-1": dispatchedLog() };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const { res } = makeRes();
    await events(req(messagesBody("pn-1", [{ id: "msg-id-1", status: "delivered" }])), res);
    await drain();

    assert.equal(logs["msg-id-1"].entrega, "DELIVERED");
    assert.equal(logs["msg-id-1"].deliveryReason, null);
    // A delivery is not an engagement — the interaction axes stay untouched.
    assert.equal(logs["msg-id-1"].resultado, null);
  });

  it("records a read receipt in channelData without moving an axis", async () => {
    const logs = { "msg-id-1": dispatchedLog({ entrega: "DELIVERED" }) };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const { res } = makeRes();
    await events(
      req(messagesBody("pn-1", [{ id: "msg-id-1", status: "read", timestamp: "1755648000" }])),
      res
    );
    await drain();

    assert.equal(logs["msg-id-1"].channelData?.openedAt, "2025-08-20T00:00:00.000Z");
    assert.equal(logs["msg-id-1"].entrega, "DELIVERED");
    assert.equal(logs["msg-id-1"].resultado, null);
  });

  it("keeps the first read timestamp when a second read arrives", async () => {
    const logs = {
      "msg-id-1": dispatchedLog({
        entrega: "DELIVERED",
        channelData: { openedAt: "2025-08-19T00:00:00.000Z" }
      })
    };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const { res } = makeRes();
    await events(
      req(messagesBody("pn-1", [{ id: "msg-id-1", status: "read", timestamp: "1755648000" }])),
      res
    );
    await drain();

    assert.equal(logs["msg-id-1"].channelData?.openedAt, "2025-08-19T00:00:00.000Z");
  });

  it("maps a failed status to FAILED with an actionable reason", async () => {
    const logs = { "msg-id-1": dispatchedLog() };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "msg-id-1", status: "failed", errors: [{ code: 131026, title: "Undeliverable" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(logs["msg-id-1"].entrega, "FAILED");
    assert.equal(logs["msg-id-1"].deliveryReason, "INVALID_DESTINATION");
    // Not an opt-out — only 131050 carries that meaning.
    assert.equal(logs["msg-id-1"].resultado, null);
  });

  it("falls back to PROVIDER_ERROR for an unmapped error code", async () => {
    const logs = { "msg-id-1": dispatchedLog() };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "msg-id-1", status: "failed", errors: [{ code: 999, title: "Other error" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(logs["msg-id-1"].entrega, "FAILED");
    assert.equal(logs["msg-id-1"].deliveryReason, "PROVIDER_ERROR");
    assert.equal(logs["msg-id-1"].resultado, null);
  });

  it("records error 131050 on both axes: FAILED/REJECTED and resultado OPT_OUT", async () => {
    const logs = { "msg-id-1": dispatchedLog() };
    const db = makeDb({
      senders: { "pn-1": { workspaceRef: "ws-1", qualityRating: null } },
      logs
    });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "msg-id-1", status: "failed", errors: [{ code: 131050, title: "User opted out" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(logs["msg-id-1"].resultado, "OPT_OUT");
    // A platform block is also a delivery failure — recording only the resultado would keep
    // opt-outs invisible to the contactability KPI.
    assert.equal(logs["msg-id-1"].entrega, "FAILED");
    assert.equal(logs["msg-id-1"].deliveryReason, "REJECTED");
  });

  it("records a sent status as visibility only", async () => {
    const logs = { "msg-id-1": dispatchedLog() };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const { res } = makeRes();
    await events(req(messagesBody("pn-1", [{ id: "msg-id-1", status: "sent" }])), res);
    await drain();

    assert.equal(logs["msg-id-1"].channelData?.deliveryStatus, "sent");
    assert.equal(logs["msg-id-1"].entrega, "DISPATCHED");
  });

  it("never moves entrega back off a finalized value", async () => {
    const logs = {
      "msg-id-1": dispatchedLog({ entrega: "FAILED", deliveryReason: "INVALID_DESTINATION" })
    };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const { res } = makeRes();
    await events(req(messagesBody("pn-1", [{ id: "msg-id-1", status: "delivered" }])), res);
    await drain();

    assert.equal(logs["msg-id-1"].entrega, "FAILED");
    assert.equal(logs["msg-id-1"].deliveryReason, "INVALID_DESTINATION");
  });

  it("skips a malformed status without abandoning the ones after it", async () => {
    const logs = { "msg-id-2": dispatchedLog({ id: "log-2" }) };
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "msg-id-1", status: "" },
      { id: "msg-id-2", status: "delivered" }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(logs["msg-id-2"].entrega, "DELIVERED");
  });

  it("writes nothing when no gestión row matches the providerRef", async () => {
    const logs: Record<string, LogRow> = {};
    const db = makeDb({ logs });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "unknown-msg", status: "failed", errors: [{ code: 131050, title: "Opted out" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    // Nothing to correlate to, so nothing is written — and crucially no row is invented.
    assert.deepEqual(logs, {});
  });
});

describe("whatsAppWebhook.events — quality rating", () => {
  it("updates the sender qualityRating from a quality_rating change", async () => {
    const senders: Record<string, SenderRow> = {
      "pn-2": { workspaceRef: "ws-1", qualityRating: "GREEN" }
    };
    const db = makeDb({ senders });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const { res } = makeRes();
    await events(req(qualityBody("pn-2", "RED")), res);
    await drain();

    assert.equal(senders["pn-2"]!.qualityRating, "RED");
  });

  it("ignores a quality_rating change with missing phoneNumberId", async () => {
    const senders: Record<string, SenderRow> = {
      "pn-2": { workspaceRef: "ws-1", qualityRating: "GREEN" }
    };
    const db = makeDb({ senders });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "quality_rating", value: { new_quality_rating: "RED" } }] }]
    };
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(senders["pn-2"]!.qualityRating, "GREEN");
  });
});

function req(body: unknown) {
  return makeReq({ body });
}
