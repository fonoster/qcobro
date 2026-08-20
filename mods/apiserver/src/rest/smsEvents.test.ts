import { describe, it } from "node:test";
import assert from "node:assert/strict";
import twilio from "twilio";
import { createSmsEventsHandler, type SmsEventsDeps } from "./smsEvents.js";

const AUTH_TOKEN = "test-auth-token";
const CALLBACK_URL = "https://qcobro.example.com/api/sms/events";

interface FakeLog {
  id: string;
  entrega: string;
  deliveryReason: string | null;
  channelData: Record<string, unknown> | null;
}

function makePrisma(logs: Record<string, FakeLog>) {
  const updates: { id: string; data: unknown }[] = [];
  const prisma = {
    accountContactLog: {
      findFirst: async ({ where }: { where: { providerRef: string } }) => {
        const log = Object.values(logs).find((l) => l.id === where.providerRef);
        return log
          ? {
              id: log.id,
              entrega: log.entrega,
              deliveryReason: log.deliveryReason,
              channelData: log.channelData
            }
          : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        Object.assign(logs[where.id], data);
        return logs[where.id];
      }
    }
  };
  return { prisma, updates };
}

function makeRes() {
  const state = { statusCode: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    }
  };
  return { res, state };
}

function makeReq(body: Record<string, string>, signature: string | undefined) {
  return {
    body,
    header: (name: string) => (name === "X-Twilio-Signature" ? signature : undefined)
  };
}

function makeDeps(over: Partial<SmsEventsDeps> = {}): SmsEventsDeps {
  return { authToken: AUTH_TOKEN, callbackUrl: CALLBACK_URL, ...over };
}

describe("createSmsEventsHandler", () => {
  it("processes a validly signed delivered callback and finalizes the gestión", async () => {
    const { prisma, updates } = makePrisma({
      SM123: { id: "SM123", entrega: "DISPATCHED", deliveryReason: null, channelData: null }
    });
    const body = { MessageSid: "SM123", MessageStatus: "delivered" };
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, CALLBACK_URL, body);

    const handler = createSmsEventsHandler(prisma as never, makeDeps());
    const { res, state } = makeRes();

    await handler(makeReq(body, signature) as never, res as never);

    assert.equal(state.statusCode, 200);
    assert.equal(
      updates[0]?.data && (updates[0].data as Record<string, unknown>).entrega,
      "DELIVERED"
    );
  });

  it("rejects a request with an invalid signature — no data is read or written", async () => {
    const { prisma, updates } = makePrisma({
      SM123: { id: "SM123", entrega: "DISPATCHED", deliveryReason: null, channelData: null }
    });
    const body = { MessageSid: "SM123", MessageStatus: "delivered" };

    const handler = createSmsEventsHandler(prisma as never, makeDeps());
    const { res, state } = makeRes();

    await handler(makeReq(body, "not-a-real-signature") as never, res as never);

    assert.equal(state.statusCode, 403);
    assert.equal(updates.length, 0);
  });

  it("rejects a request with no signature header at all", async () => {
    const { prisma, updates } = makePrisma({});
    const body = { MessageSid: "SM123", MessageStatus: "delivered" };

    const handler = createSmsEventsHandler(prisma as never, makeDeps());
    const { res, state } = makeRes();

    await handler(makeReq(body, undefined) as never, res as never);

    assert.equal(state.statusCode, 403);
    assert.equal(updates.length, 0);
  });

  it("acknowledges (200) a validly signed callback for an unknown MessageSid", async () => {
    const { prisma, updates } = makePrisma({});
    const body = { MessageSid: "SM999", MessageStatus: "delivered" };
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, CALLBACK_URL, body);

    const handler = createSmsEventsHandler(prisma as never, makeDeps());
    const { res, state } = makeRes();

    await handler(makeReq(body, signature) as never, res as never);

    assert.equal(state.statusCode, 200);
    assert.equal(updates.length, 0);
  });

  it("a failed callback with a Twilio ErrorCode sets deliveryReason", async () => {
    const { prisma, updates } = makePrisma({
      SM123: { id: "SM123", entrega: "DISPATCHED", deliveryReason: null, channelData: null }
    });
    const body = { MessageSid: "SM123", MessageStatus: "failed", ErrorCode: "21614" };
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, CALLBACK_URL, body);

    const handler = createSmsEventsHandler(prisma as never, makeDeps());
    const { res, state } = makeRes();

    await handler(makeReq(body, signature) as never, res as never);

    assert.equal(state.statusCode, 200);
    const data = updates[0]?.data as Record<string, unknown>;
    assert.equal(data.entrega, "FAILED");
    assert.equal(data.deliveryReason, "CHANNEL_UNSUPPORTED");
  });

  it("a signature computed for a different callback URL is rejected", async () => {
    const { prisma, updates } = makePrisma({
      SM123: { id: "SM123", entrega: "DISPATCHED", deliveryReason: null, channelData: null }
    });
    const body = { MessageSid: "SM123", MessageStatus: "delivered" };
    // Signed for a different URL than the one this handler is configured with.
    const signature = twilio.getExpectedTwilioSignature(
      AUTH_TOKEN,
      "https://attacker.example.com/api/sms/events",
      body
    );

    const handler = createSmsEventsHandler(prisma as never, makeDeps());
    const { res, state } = makeRes();

    await handler(makeReq(body, signature) as never, res as never);

    assert.equal(state.statusCode, 403);
    assert.equal(updates.length, 0);
  });
});
