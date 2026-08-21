import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import type { ResendConfig } from "@qcobro/common";
import { createEmailEventsHandler, normalizeEmailEvent } from "./emailEvents.js";

// ── Stubs ────────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  providerRef: string | null;
  entrega: string;
  deliveryReason: string | null;
  resultado: string | null;
  channelData: Record<string, unknown> | null;
}

function dispatched(overrides: Partial<Row> = {}): Row {
  return {
    id: "log-1",
    providerRef: "token-1",
    entrega: "DISPATCHED",
    deliveryReason: null,
    resultado: null,
    channelData: null,
    ...overrides
  };
}

function makePrisma(row: Row | null) {
  const state = row;
  return {
    prisma: {
      accountContactLog: {
        findFirst: async ({ where }: { where: { agentType?: string } }) =>
          state && where.agentType === "EMAIL" ? state : null,
        update: async ({ data }: { data: Partial<Row> }) => {
          Object.assign(state!, data);
          return state;
        }
      }
    } as unknown as PrismaClient,
    row: state
  };
}

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
    }
  } as unknown as Response;
  return { res, code: () => code, body: () => responseBody };
}

const SECRET = "whsec_" + Buffer.from("super-secret-key").toString("base64");

/** Build a request whose svix headers carry a valid signature over the raw body. */
function signedReq(payload: unknown, secret = SECRET) {
  const rawBody = JSON.stringify(payload);
  const id = "msg_1";
  const ts = "1755648000";
  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", keyBytes).update(`${id}.${ts}.${rawBody}`).digest("base64");
  return {
    body: payload,
    rawBody,
    headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` }
  } as unknown as Request;
}

function unsignedReq(payload: unknown) {
  return { body: payload, rawBody: JSON.stringify(payload), headers: {} } as unknown as Request;
}

const resend = {
  apiKey: "re_test",
  fromEmail: "cobranza@notices.example.com",
  inboundDomain: "notices.example.com",
  eventsSigningSecret: SECRET,
  maxEmailsPerMinute: 60,
  maxRepliesDefault: 3
} as unknown as ResendConfig;

function deliveredEvent(emailId = "resend-1") {
  return {
    type: "email.delivered",
    created_at: "2026-08-20T12:00:00.000Z",
    data: { email_id: emailId, to: ["cliente@example.com"] }
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeEmailEvent", () => {
  it("pulls the message id and event type out of the envelope", () => {
    const event = normalizeEmailEvent(deliveredEvent());
    assert.equal(event?.providerMessageId, "resend-1");
    assert.equal(event?.type, "email.delivered");
    assert.equal(event?.at, "2026-08-20T12:00:00.000Z");
  });

  it("prefers the open's own timestamp over the envelope's", () => {
    const event = normalizeEmailEvent({
      type: "email.opened",
      created_at: "2026-08-20T12:00:00.000Z",
      data: { email_id: "resend-1", open: { timestamp: "2026-08-20T09:30:00.000Z" } }
    });
    assert.equal(event?.at, "2026-08-20T09:30:00.000Z");
  });

  it("extracts the bounce classification", () => {
    const event = normalizeEmailEvent({
      type: "email.bounced",
      created_at: "2026-08-20T12:00:00.000Z",
      data: { email_id: "resend-1", bounce: { type: "Permanent", subType: "NoEmail" } }
    });
    assert.equal(event?.bounceType, "Permanent");
    assert.equal(event?.bounceSubType, "NoEmail");
  });

  it("accepts Resend's snake_case bounce subtype", () => {
    const event = normalizeEmailEvent({
      type: "email.bounced",
      data: { email_id: "resend-1", bounce: { type: "Transient", sub_type: "MailboxFull" } }
    });
    assert.equal(event?.bounceSubType, "MailboxFull");
  });

  it("returns null when the payload carries no email id", () => {
    assert.equal(normalizeEmailEvent({ type: "email.delivered", data: {} }), null);
  });

  it("returns null when the payload carries no type", () => {
    assert.equal(normalizeEmailEvent({ data: { email_id: "resend-1" } }), null);
  });
});

describe("emailEvents handler", () => {
  it("is inert with 503 when Resend is unconfigured", async () => {
    const { prisma, row } = makePrisma(dispatched());
    const handler = createEmailEventsHandler(prisma, { resend: undefined });
    const { res, code } = makeRes();

    await handler(signedReq(deliveredEvent()), res);

    assert.equal(code(), 503);
    assert.equal(row!.entrega, "DISPATCHED");
  });

  it("rejects an unsigned request with 401 and writes nothing", async () => {
    const { prisma, row } = makePrisma(dispatched());
    const handler = createEmailEventsHandler(prisma, { resend });
    const { res, code } = makeRes();

    await handler(unsignedReq(deliveredEvent()), res);

    assert.equal(code(), 401);
    assert.equal(row!.entrega, "DISPATCHED");
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const { prisma } = makePrisma(dispatched());
    const handler = createEmailEventsHandler(prisma, { resend });
    const { res, code } = makeRes();

    const otherSecret = "whsec_" + Buffer.from("not-the-right-key").toString("base64");
    await handler(signedReq(deliveredEvent(), otherSecret), res);

    assert.equal(code(), 401);
  });

  it("accepts a valid signature and advances the gestión", async () => {
    const { prisma, row } = makePrisma(dispatched());
    const handler = createEmailEventsHandler(prisma, { resend });
    const { res, code } = makeRes();

    await handler(signedReq(deliveredEvent()), res);

    assert.equal(code(), 200);
    assert.equal(row!.entrega, "DELIVERED");
  });

  it("skips verification when no events secret is configured", async () => {
    const { prisma, row } = makePrisma(dispatched());
    const openConfig = { ...(resend as object), eventsSigningSecret: undefined } as ResendConfig;
    const handler = createEmailEventsHandler(prisma, { resend: openConfig });
    const { res, code } = makeRes();

    await handler(unsignedReq(deliveredEvent()), res);

    assert.equal(code(), 200);
    assert.equal(row!.entrega, "DELIVERED");
  });

  it("acknowledges an uncorrelated event with 200 so Resend stops retrying", async () => {
    const { prisma } = makePrisma(null);
    const handler = createEmailEventsHandler(prisma, { resend });
    const { res, code } = makeRes();

    await handler(signedReq(deliveredEvent("unknown-id")), res);

    assert.equal(code(), 200);
  });

  it("acknowledges an unparseable payload rather than rejecting it", async () => {
    const { prisma } = makePrisma(dispatched());
    const handler = createEmailEventsHandler(prisma, { resend });
    const { res, code, body } = makeRes();

    await handler(signedReq({ type: "email.delivered", data: {} }), res);

    assert.equal(code(), 200);
    assert.deepEqual(body(), { ignored: true, reason: "unrecognized_payload" });
  });

  it("attributes the flight-recorder event by the matched gestión's providerRef", async () => {
    const { prisma } = makePrisma(dispatched({ providerRef: "token-42" }));
    const recorded: Array<Record<string, unknown>> = [];
    const handler = createEmailEventsHandler(prisma, {
      resend,
      recordEvent: (e) => void recorded.push(e as unknown as Record<string, unknown>)
    });
    const { res } = makeRes();

    await handler(signedReq(deliveredEvent()), res);

    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]!.providerRef, "token-42");
    assert.equal(recorded[0]!.matched, true);
  });

  it("records an unmatched event without a providerRef", async () => {
    const { prisma } = makePrisma(null);
    const recorded: Array<Record<string, unknown>> = [];
    const handler = createEmailEventsHandler(prisma, {
      resend,
      recordEvent: (e) => void recorded.push(e as unknown as Record<string, unknown>)
    });
    const { res } = makeRes();

    await handler(signedReq(deliveredEvent("unknown-id")), res);

    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]!.matched, false);
    assert.equal(recorded[0]!.providerRef, undefined);
  });
});
