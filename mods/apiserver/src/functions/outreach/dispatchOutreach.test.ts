import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DispatchDeps, WhatsAppSendTemplateInput } from "@qcobro/common";
import { createDispatchOutreach } from "./dispatchOutreach.js";

function makeDeps(overrides: Partial<DispatchDeps> = {}) {
  const calls: { sms: unknown[]; voice: unknown[]; email: unknown[]; whatsapp: unknown[] } = {
    sms: [],
    voice: [],
    email: [],
    whatsapp: []
  };
  const deps: DispatchDeps = {
    smsClient: {
      sendMessage: async (input) => {
        calls.sms.push(input);
        return { sid: "SM123" };
      }
    },
    outboundCallClient: {
      createCall: async (input) => {
        calls.voice.push(input);
        return { ref: "call-1" };
      }
    },
    emailClient: {
      sendEmail: async (input) => {
        calls.email.push(input);
        return { id: "email-1" };
      }
    },
    emailFrom: { email: "cobranza@mikro.do", name: "Mikro", inboundDomain: "inbound.mikro.do" },
    whatsAppClient: {
      sendTemplate: async (input: WhatsAppSendTemplateInput) => {
        calls.whatsapp.push(input);
        return { id: "wamid-1" };
      },
      sendText: async (input: { to: string; body: string }) => {
        calls.whatsapp.push(input);
        return { id: "wamid-2" };
      },
      fetchTemplate: async () => null
    },
    fonosterNumbers: ["+50611111111"],
    twilioFromNumbers: ["+15550001111"],
    // Deterministic selection for assertions.
    pickNumber: (numbers) => numbers[0],
    ...overrides
  };
  return { deps, calls };
}

describe("dispatchOutreach", () => {
  it("sends an SMS with the rendered body from a pooled number", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "SMS",
      to: "+50670000000",
      context: { firstName: "Ana", outstandingBalance: 900 },
      body: "Hola {{firstName}}, debe {{outstandingBalance}}"
    });

    assert.deepEqual(calls.sms, [
      { from: "+15550001111", to: "+50670000000", body: "Hola Ana, debe 900" }
    ]);
    assert.equal(result.channel, "SMS");
    assert.equal(result.providerRef, "SM123");
    assert.equal(result.renderedBody, "Hola Ana, debe 900");
  });

  it("places a voice call to the app ref with only the rendered opening line as metadata", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "VOICE_AI",
      to: "+50670000000",
      context: { firstName: "Luis" },
      appRef: "app-9",
      firstMessage: "Hola {{firstName}}"
    });

    assert.equal(calls.voice.length, 1);
    // The system prompt lives on the synced Fonoster app, so it is never resent here.
    assert.deepEqual(calls.voice[0], {
      from: "+50611111111",
      to: "+50670000000",
      appRef: "app-9",
      metadata: { firstMessage: "Hola Luis" }
    });
    assert.equal(result.providerRef, "call-1");
    assert.equal(result.renderedBody, "Hola Luis");
  });

  it("pre-recorded renders its script and passes it as the ready message", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "VOICE_PRERECORDED",
      to: "+50670000000",
      context: { firstName: "Eva" },
      appRef: "ext-app-1",
      script: "Hola {{firstName}}, este es un recordatorio de pago."
    });

    assert.equal(calls.voice.length, 1);
    assert.deepEqual(calls.voice[0], {
      from: "+50611111111",
      to: "+50670000000",
      appRef: "ext-app-1",
      metadata: { message: "Hola Eva, este es un recordatorio de pago." }
    });
    assert.equal(result.channel, "VOICE_PRERECORDED");
    assert.equal(result.renderedBody, "Hola Eva, este es un recordatorio de pago.");
  });

  it("sends an EMAIL with rendered subject+body and returns the reply-to token", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "EMAIL",
      to: "ana@example.com",
      context: { firstName: "Ana", outstandingBalance: 900 },
      subject: "Saldo de {{firstName}}",
      body: "Hola {{firstName}}, debe {{outstandingBalance}}"
    });

    assert.equal(calls.email.length, 1);
    const sent = calls.email[0] as { to: string; subject: string; body: string; replyTo: string };
    assert.equal(sent.to, "ana@example.com");
    assert.equal(sent.subject, "Saldo de Ana");
    assert.equal(sent.body, "Hola Ana, debe 900");
    // providerRef IS the reply-to token, and the reply-to address carries it.
    assert.equal(result.channel, "EMAIL");
    assert.ok(result.providerRef.length > 0);
    assert.equal(sent.replyTo, `reply+${result.providerRef}@inbound.mikro.do`);
  });

  it("rejects an EMAIL with no subject and never calls the provider (validation)", async () => {
    const { deps, calls } = makeDeps();
    await assert.rejects(() =>
      createDispatchOutreach(deps)({
        channel: "EMAIL",
        to: "ana@example.com",
        context: {},
        body: "hola"
      })
    );
    assert.equal(calls.email.length, 0);
  });

  it("rejects an SMS with no body and never calls the provider (validation)", async () => {
    const { deps, calls } = makeDeps();
    await assert.rejects(() =>
      createDispatchOutreach(deps)({ channel: "SMS", to: "+50670000000", context: {} })
    );
    assert.equal(calls.sms.length, 0);
  });

  it("fails clearly when the SMS channel is not configured", async () => {
    const { deps, calls } = makeDeps({ smsClient: null });
    await assert.rejects(
      () =>
        createDispatchOutreach(deps)({
          channel: "SMS",
          to: "+50670000000",
          context: {},
          body: "hi"
        }),
      /not configured/
    );
    assert.equal(calls.sms.length, 0);
  });

  it("fails clearly when the sending-number pool is empty", async () => {
    const { deps, calls } = makeDeps({ twilioFromNumbers: [] });
    await assert.rejects(
      () =>
        createDispatchOutreach(deps)({
          channel: "SMS",
          to: "+50670000000",
          context: {},
          body: "hi"
        }),
      /no configured sender numbers/
    );
    assert.equal(calls.sms.length, 0);
  });

  it("fails when a voice template was never synced (no appRef)", async () => {
    const { deps, calls } = makeDeps();
    await assert.rejects(() =>
      createDispatchOutreach(deps)({
        channel: "VOICE_PRERECORDED",
        to: "+50670000000",
        context: {},
        script: "Hola"
      })
    );
    assert.equal(calls.voice.length, 0);
  });

  it("WHATSAPP sends the template with named params extracted from the message body", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "WHATSAPP",
      to: "+50670000000",
      context: { firstName: "Ana", outstandingBalance: 1500 },
      templateName: "recordatorio_pago",
      languageCode: "es_DO",
      body: "Hola {{firstName}}, su saldo es {{outstandingBalance}}"
    });

    assert.equal(calls.whatsapp.length, 1);
    const sent = calls.whatsapp[0] as {
      to: string;
      templateName: string;
      languageCode: string;
      params: Array<{ parameterName: string; text: string }>;
    };
    assert.equal(sent.to, "+50670000000");
    assert.equal(sent.templateName, "recordatorio_pago");
    assert.equal(sent.languageCode, "es_DO");
    // Each {{var}} in the body becomes a named parameter rendered against the context.
    assert.deepEqual(sent.params, [
      { parameterName: "firstName", text: "Ana" },
      { parameterName: "outstandingBalance", text: "1500" }
    ]);
    assert.equal(result.channel, "WHATSAPP");
    assert.equal(result.providerRef, "wamid-1");
    assert.equal(result.renderedBody, "Hola Ana, su saldo es 1500");
  });

  it("WHATSAPP with no template variables sends an empty params array", async () => {
    const { deps, calls } = makeDeps();
    await createDispatchOutreach(deps)({
      channel: "WHATSAPP",
      to: "+50670000000",
      context: {},
      templateName: "saludo_fijo",
      languageCode: "es_DO",
      body: "Hola, le recordamos su pago pendiente."
    });

    const sent = calls.whatsapp[0] as { params: unknown[] };
    assert.deepEqual(sent.params, []);
  });

  it("WHATSAPP fails clearly when the workspace integration is not resolved", async () => {
    const { deps, calls } = makeDeps({ whatsAppClient: null });
    await assert.rejects(
      () =>
        createDispatchOutreach(deps)({
          channel: "WHATSAPP",
          to: "+50670000000",
          context: {},
          templateName: "recordatorio_pago",
          languageCode: "es_DO",
          body: "Hola {{firstName}}"
        }),
      /not configured/
    );
    assert.equal(calls.whatsapp.length, 0);
  });

  it("wraps a provider failure in a generic message and preserves the original as cause", async () => {
    const providerError = new Error("Authenticate");
    const { deps } = makeDeps({
      smsClient: {
        sendMessage: async () => {
          throw providerError;
        }
      }
    });
    await assert.rejects(
      () =>
        createDispatchOutreach(deps)({
          channel: "SMS",
          to: "+50670000000",
          context: {},
          body: "hi"
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        // The raw provider message (credentials, balance, etc.) must never reach a
        // customer-facing surface — only a generic reason, with the original chained.
        assert.doesNotMatch(err.message, /Authenticate/);
        assert.match(err.message, /SMS dispatch failed/);
        assert.equal(err.cause, providerError);
        return true;
      }
    );
  });
});
