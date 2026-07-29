import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DispatchError } from "@qcobro/common";
import { ResendEmailClient } from "./resendEmailClient.js";

const SETTINGS = {
  apiKey: "key",
  fromEmail: "a@example.com",
  inboundDomain: "reply.example.com",
  maxEmailsPerMinute: 60,
  maxRepliesDefault: 3
};

const SEND_INPUT = {
  from: "a@example.com",
  to: "customer@example.com",
  subject: "Hola",
  body: "body",
  replyTo: "reply+token@reply.example.com"
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const originalFetch = globalThis.fetch;

describe("ResendEmailClient.sendEmail classification", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("classifies a 422 hard-bounce/invalid-address rejection as DELIVERY_REJECTED", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(422, { message: "Invalid `to` field" })) as typeof fetch;

    const client = new ResendEmailClient(SETTINGS);
    await assert.rejects(
      () => client.sendEmail(SEND_INPUT),
      (err: unknown) => err instanceof DispatchError && err.kind === "DELIVERY_REJECTED"
    );
  });

  it("classifies a 401 auth failure as SYSTEM_ERROR", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(401, { message: "Invalid API key" })) as typeof fetch;

    const client = new ResendEmailClient(SETTINGS);
    await assert.rejects(
      () => client.sendEmail(SEND_INPUT),
      (err: unknown) => err instanceof DispatchError && err.kind === "SYSTEM_ERROR"
    );
  });

  it("classifies a 5xx outage as SYSTEM_ERROR", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(503, { message: "Service unavailable" })) as typeof fetch;

    const client = new ResendEmailClient(SETTINGS);
    await assert.rejects(
      () => client.sendEmail(SEND_INPUT),
      (err: unknown) => err instanceof DispatchError && err.kind === "SYSTEM_ERROR"
    );
  });

  it("classifies a network failure as SYSTEM_ERROR (unclassifiable falls back safe)", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const client = new ResendEmailClient(SETTINGS);
    await assert.rejects(
      () => client.sendEmail(SEND_INPUT),
      (err: unknown) => err instanceof DispatchError && err.kind === "SYSTEM_ERROR"
    );
  });
});
