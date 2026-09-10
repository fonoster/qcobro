import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VOICE_IDLE_OPTIONS,
  createAgentTemplateSchema,
  voicePrerecordedDtmfSchema
} from "./agentTemplates.js";

describe("voicePrerecordedDtmfSchema", () => {
  it("accepts an empty config (no menu)", () => {
    assert.equal(voicePrerecordedDtmfSchema.safeParse({}).success, true);
  });

  it("accepts a full, valid menu", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      repeatDigit: "1",
      repeatMessage: "Presione 1 para repetir.",
      maxRepeats: 2,
      optOutDigit: "9",
      optOutMessage: "Presione 9 para darse de baja.",
      optOutConfirmationMessage: "Hemos registrado su solicitud."
    });
    assert.equal(result.success, true);
  });

  it("accepts just the repeat pair", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      repeatDigit: "1",
      repeatMessage: "Presione 1 para repetir."
    });
    assert.equal(result.success, true);
  });

  it("rejects a repeat digit with no message", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({ repeatDigit: "1" });
    assert.equal(result.success, false);
  });

  it("rejects a repeat message with no digit", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({ repeatMessage: "Presione 1." });
    assert.equal(result.success, false);
  });

  it("rejects an opt-out digit with no message", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({ optOutDigit: "9" });
    assert.equal(result.success, false);
  });

  it("rejects an opt-out digit + message with no confirmation message", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      optOutDigit: "9",
      optOutMessage: "Presione 9 para darse de baja."
    });
    assert.equal(result.success, false);
  });

  it("rejects a confirmation message with no opt-out digit", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      optOutConfirmationMessage: "Hemos registrado su solicitud."
    });
    assert.equal(result.success, false);
  });

  it("rejects matching repeat and opt-out digits", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      repeatDigit: "1",
      repeatMessage: "Presione 1.",
      optOutDigit: "1",
      optOutMessage: "Presione 1 para salir."
    });
    assert.equal(result.success, false);
  });

  it("rejects a multi-character digit", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      repeatDigit: "12",
      repeatMessage: "Presione 12."
    });
    assert.equal(result.success, false);
  });

  it("rejects a non-numeric digit", () => {
    const result = voicePrerecordedDtmfSchema.safeParse({
      repeatDigit: "#",
      repeatMessage: "Presione #."
    });
    assert.equal(result.success, false);
  });
});

describe("createAgentTemplateSchema — VOICE_AI idle options", () => {
  const base = {
    name: "Cobrador AI",
    type: "VOICE_AI" as const,
    voice: "voice-x",
    systemPrompt: "Be polite",
    language: "es"
  };

  it("defaults all three idle fields to DEFAULT_VOICE_IDLE_OPTIONS when omitted", () => {
    const result = createAgentTemplateSchema.safeParse(base);
    assert.equal(result.success, true);
    assert.equal(
      (result as { data: Record<string, unknown> }).data.idleMessage,
      DEFAULT_VOICE_IDLE_OPTIONS.message
    );
    assert.equal(
      (result as { data: Record<string, unknown> }).data.idleTimeout,
      DEFAULT_VOICE_IDLE_OPTIONS.timeout
    );
    assert.equal(
      (result as { data: Record<string, unknown> }).data.idleMaxTimeoutCount,
      DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount
    );
  });

  it("keeps the deployment default at 8000 ms / 3 (supersedes PR #165's 4500)", () => {
    assert.equal(DEFAULT_VOICE_IDLE_OPTIONS.timeout, 8000);
    assert.equal(DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount, 3);
    assert.equal(DEFAULT_VOICE_IDLE_OPTIONS.message.length > 0, true);
  });

  it("accepts explicit idle values at the boundaries", () => {
    const result = createAgentTemplateSchema.safeParse({
      ...base,
      idleMessage: "¿Sigue ahí?",
      idleTimeout: 3000,
      idleMaxTimeoutCount: 1
    });
    assert.equal(result.success, true);
  });

  it("rejects an idleTimeout below 3000 ms", () => {
    const result = createAgentTemplateSchema.safeParse({
      ...base,
      idleTimeout: 2999
    });
    assert.equal(result.success, false);
  });

  it("rejects an idleMaxTimeoutCount below 1", () => {
    const result = createAgentTemplateSchema.safeParse({
      ...base,
      idleMaxTimeoutCount: 0
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty idleMessage", () => {
    const result = createAgentTemplateSchema.safeParse({ ...base, idleMessage: "" });
    assert.equal(result.success, false);
  });

  it("rejects a non-integer idleTimeout", () => {
    const result = createAgentTemplateSchema.safeParse({
      ...base,
      idleTimeout: 5000.5
    });
    assert.equal(result.success, false);
  });
});
