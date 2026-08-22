import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCreateAgentTemplate } from "./createAgentTemplate.js";
import { ValidationError } from "@qcobro/common";

interface Created {
  base?: Record<string, unknown>;
  voiceAi?: Record<string, unknown>;
  sms?: Record<string, unknown>;
}

function makeClient() {
  const created: Created = {};
  const updates: Record<string, Record<string, unknown>> = {};
  const child = (key: keyof Created) => ({
    create: async (args: { data: Record<string, unknown> }) => {
      created[key] = args.data;
      return args.data as never;
    },
    update: async (args: { data: Record<string, unknown> }) => {
      updates[key] = args.data;
      return {} as never;
    },
    findUnique: async () =>
      (created[key] ? { fonosterAppRef: null, ...created[key] } : null) as never
  });

  const client = {
    agentTemplate: {
      create: async (args: { data: Record<string, unknown> }) => {
        created.base = args.data;
        return { id: "tmpl-1", ...args.data } as never;
      }
    },
    voiceAiConfig: child("voiceAi"),
    voicePrerecordedConfig: child("voiceAi"),
    smsConfig: child("sms"),
    emailConfig: child("sms"),
    whatsAppConfig: child("sms"),
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
  };

  return { client, created, updates };
}

/** Stub voice-application port: records calls and returns a fixed ref (or throws). */
function makeVoiceClient(opts: { fail?: boolean } = {}) {
  const calls: { method: string; input: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      createApplication: async (input: Record<string, unknown>) => {
        calls.push({ method: "create", input });
        if (opts.fail) throw new Error("fonoster down");
        return { ref: "app-1" };
      },
      updateApplication: async (_ref: string, input: Record<string, unknown>) => {
        calls.push({ method: "update", input });
        if (opts.fail) throw new Error("fonoster down");
        return { ref: "app-1" };
      },
      deleteApplication: async () => {}
    }
  };
}

const VOICE_AI_INPUT = {
  name: "Cobrador AI",
  type: "VOICE_AI" as const,
  voice: "voice-x",
  systemPrompt: "Be polite",
  firstMessage: "Hola",
  language: "es"
};

describe("createAgentTemplate", () => {
  it("creates a base row and a VoiceAiConfig child row", async () => {
    const { client, created } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    const result = await fn({
      name: "Cobrador AI",
      type: "VOICE_AI",
      voice: "voice-x",
      systemPrompt: "Be polite",
      firstMessage: "Hola",
      language: "es"
    });

    assert.equal((result as { id: string }).id, "tmpl-1");
    assert.equal(created.base?.workspaceRef, "ws-1");
    assert.equal(created.base?.type, "VOICE_AI");
    assert.ok(created.voiceAi, "child VoiceAiConfig row created");
    assert.equal(created.voiceAi?.systemPrompt, "Be polite");
    // fonosterAppName defaults to the template name when omitted.
    assert.equal(created.voiceAi?.fonosterAppName, "Cobrador AI");
  });

  it("creates an SmsConfig child row for SMS type", async () => {
    const { client, created } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await fn({ name: "SMS bot", type: "SMS", messageBody: "Pague hoy" });

    assert.ok(created.sms, "child SmsConfig row created");
    assert.equal(created.sms?.messageBody, "Pague hoy");
    assert.equal(created.sms?.senderId, null);
  });

  it("rejects an unknown agent type", async () => {
    const { client } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await assert.rejects(
      () => fn({ name: "X", type: "TELEPATHY", messageBody: "hi" }),
      ValidationError
    );
  });

  it("rejects missing type-specific required fields", async () => {
    const { client } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    // VOICE_AI requires systemPrompt/voice/language (firstMessage is optional).
    await assert.rejects(() => fn({ name: "X", type: "VOICE_AI", voice: "v" }), ValidationError);
  });

  it("creates a VOICE_AI template without a first message (optional)", async () => {
    const { client, created } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await fn({
      name: "Sin saludo",
      type: "VOICE_AI",
      voice: "voice-x",
      systemPrompt: "Be polite",
      language: "es"
    });

    assert.ok(created.voiceAi, "child VoiceAiConfig row created");
    // Omitted first message persists as null rather than failing validation.
    assert.equal(created.voiceAi?.firstMessage, null);
  });

  it("syncs VOICE_AI to Fonoster and stores the returned app ref", async () => {
    const { client, updates } = makeClient();
    const voice = makeVoiceClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1", voice.client as never);

    await fn(VOICE_AI_INPUT);

    assert.equal(voice.calls.length, 1);
    assert.equal(voice.calls[0]?.method, "create");
    // Mapped from the template + fonosterAppName default (the template name).
    assert.deepEqual(voice.calls[0]?.input, {
      name: "Cobrador AI",
      voice: "voice-x",
      systemPrompt: "Be polite",
      firstMessage: "Hola",
      language: "es"
    });
    assert.deepEqual(updates.voiceAi, { fonosterAppRef: "app-1" });
  });

  it("saves locally when the Fonoster sync fails (no throw, ref unset)", async () => {
    const { client, created, updates } = makeClient();
    const voice = makeVoiceClient({ fail: true });
    const fn = createCreateAgentTemplate(client as never, "ws-1", voice.client as never);

    const result = await fn(VOICE_AI_INPUT);

    // The template is still created locally.
    assert.equal((result as { id: string }).id, "tmpl-1");
    assert.ok(created.voiceAi, "child VoiceAiConfig row created");
    // The provider was attempted but the ref was never persisted.
    assert.equal(voice.calls.length, 1);
    assert.equal(updates.voiceAi, undefined);
  });

  it("creates a VOICE_PRERECORDED template with no DTMF menu (the default)", async () => {
    const { client, created } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await fn({
      name: "Aviso de pago",
      type: "VOICE_PRERECORDED",
      voice: "voice-x",
      script: "Su saldo pendiente es...",
      language: "es"
    });

    assert.ok(created.voiceAi, "child VoicePrerecordedConfig row created");
    assert.equal(created.voiceAi?.repeatDigit, null);
    assert.equal(created.voiceAi?.optOutDigit, null);
  });

  it("creates a VOICE_PRERECORDED template with a full DTMF menu", async () => {
    const { client, created } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await fn({
      name: "Aviso de pago",
      type: "VOICE_PRERECORDED",
      voice: "voice-x",
      script: "Su saldo pendiente es...",
      language: "es",
      repeatDigit: "1",
      repeatMessage: "Presione 1 para repetir.",
      maxRepeats: 2,
      optOutDigit: "9",
      optOutMessage: "Presione 9 para no recibir más llamadas.",
      optOutConfirmationMessage: "Hemos registrado su solicitud."
    });

    assert.equal(created.voiceAi?.repeatDigit, "1");
    assert.equal(created.voiceAi?.maxRepeats, 2);
    assert.equal(created.voiceAi?.optOutDigit, "9");
    assert.equal(created.voiceAi?.optOutConfirmationMessage, "Hemos registrado su solicitud.");
  });

  it("rejects an opt-out digit + message with no confirmation message", async () => {
    const { client } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await assert.rejects(
      () =>
        fn({
          name: "Aviso de pago",
          type: "VOICE_PRERECORDED",
          voice: "voice-x",
          script: "Su saldo pendiente es...",
          language: "es",
          optOutDigit: "9",
          optOutMessage: "Presione 9 para no recibir más llamadas."
        }),
      ValidationError
    );
  });

  it("rejects a DTMF digit with no message", async () => {
    const { client } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await assert.rejects(
      () =>
        fn({
          name: "Aviso de pago",
          type: "VOICE_PRERECORDED",
          voice: "voice-x",
          script: "Su saldo pendiente es...",
          language: "es",
          repeatDigit: "1"
        }),
      ValidationError
    );
  });

  it("rejects matching repeat and opt-out digits", async () => {
    const { client } = makeClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1");

    await assert.rejects(
      () =>
        fn({
          name: "Aviso de pago",
          type: "VOICE_PRERECORDED",
          voice: "voice-x",
          script: "Su saldo pendiente es...",
          language: "es",
          repeatDigit: "1",
          repeatMessage: "Presione 1 para repetir.",
          optOutDigit: "1",
          optOutMessage: "Presione 1 para darse de baja.",
          optOutConfirmationMessage: "Hemos registrado su solicitud."
        }),
      ValidationError
    );
  });

  it("does not sync non-voice types", async () => {
    const { client } = makeClient();
    const voice = makeVoiceClient();
    const fn = createCreateAgentTemplate(client as never, "ws-1", voice.client as never);

    await fn({ name: "SMS bot", type: "SMS", messageBody: "Pague hoy" });

    assert.equal(voice.calls.length, 0);
  });
});
