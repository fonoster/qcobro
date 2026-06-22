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
  const child = (key: keyof Created) => ({
    create: async (args: { data: Record<string, unknown> }) => {
      created[key] = args.data;
      return args.data as never;
    },
    update: async () => ({}) as never
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

  return { client, created };
}

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

    // VOICE_AI requires systemPrompt/firstMessage/voice/language.
    await assert.rejects(() => fn({ name: "X", type: "VOICE_AI", voice: "v" }), ValidationError);
  });
});
