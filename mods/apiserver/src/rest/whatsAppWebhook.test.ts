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
}

interface AccountRow {
  intentStatus: string | null;
}

function makeDb(opts: {
  integrationVerifyToken?: string;
  senders?: Record<string, SenderRow>;
  logs?: Record<string, LogRow>;
  accounts?: Record<string, AccountRow>;
}) {
  const senders: Record<string, SenderRow> = opts.senders ?? {};
  const logs: Record<string, LogRow> = opts.logs ?? {};
  const accounts: Record<string, AccountRow> = opts.accounts ?? {};

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
      findFirst: async ({ where }: { where: { providerRef: string } }) =>
        logs[where.providerRef] ?? null
    },
    portfolioAccount: {
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: { intentStatus: string };
      }) => {
        if (!accounts[where.id]) throw new Error("account not found");
        accounts[where.id]!.intentStatus = data.intentStatus;
        return accounts[where.id];
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

describe("whatsAppWebhook.events — opt-out processing", () => {
  it("marks the portfolioAccount OPT_OUT on a failed delivery with error 131050", async () => {
    const accounts: Record<string, AccountRow> = { "acct-1": { intentStatus: null } };
    const db = makeDb({
      senders: { "pn-1": { workspaceRef: "ws-1", qualityRating: null } },
      logs: { "msg-id-1": { id: "log-1", portfolioAccountId: "acct-1" } },
      accounts
    });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "msg-id-1", status: "failed", errors: [{ code: 131050, title: "User opted out" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(accounts["acct-1"]!.intentStatus, "OPT_OUT");
  });

  it("skips opt-out for failed statuses without error 131050", async () => {
    const accounts: Record<string, AccountRow> = { "acct-1": { intentStatus: null } };
    const db = makeDb({
      logs: { "msg-id-1": { id: "log-1", portfolioAccountId: "acct-1" } },
      accounts
    });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "msg-id-1", status: "failed", errors: [{ code: 999, title: "Other error" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(accounts["acct-1"]!.intentStatus, null);
  });

  it("skips opt-out when no gestión row matches the providerRef", async () => {
    const accounts: Record<string, AccountRow> = { "acct-1": { intentStatus: null } };
    const db = makeDb({ accounts, logs: {} });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [
      { id: "unknown-msg", status: "failed", errors: [{ code: 131050, title: "Opted out" }] }
    ]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(accounts["acct-1"]!.intentStatus, null);
  });

  it("does not trigger opt-out for delivered statuses", async () => {
    const accounts: Record<string, AccountRow> = { "acct-1": { intentStatus: null } };
    const db = makeDb({
      logs: { "msg-id-1": { id: "log-1", portfolioAccountId: "acct-1" } },
      accounts
    });
    const { events } = createWhatsAppWebhookHandlers(db, {});

    const body = messagesBody("pn-1", [{ id: "msg-id-1", status: "delivered" }]);
    const { res } = makeRes();
    await events(req(body), res);
    await drain();

    assert.equal(accounts["acct-1"]!.intentStatus, null);
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
