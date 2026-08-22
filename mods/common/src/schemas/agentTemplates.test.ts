import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { voicePrerecordedDtmfSchema } from "./agentTemplates.js";

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
