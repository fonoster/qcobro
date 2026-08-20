import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fonosterConfigSchema,
  ttsProductRefForVoice,
  twilioConfigSchema,
  type VoiceCatalogEntry
} from "./config.js";

const voices: VoiceCatalogEntry[] = [
  { id: "v-eleven", name: "Sofía", language: "es", gender: "female", provider: "elevenlabs" },
  { id: "v-google", name: "Andrés", language: "es", gender: "male", provider: "google" }
];

describe("ttsProductRefForVoice", () => {
  it("derives the TTS product ref from the voice's provider", () => {
    assert.equal(ttsProductRefForVoice("v-eleven", voices), "tts.elevenlabs");
    assert.equal(ttsProductRefForVoice("v-google", voices), "tts.google");
  });

  it("falls back to tts.elevenlabs for an unknown voice", () => {
    assert.equal(ttsProductRefForVoice("missing", voices), "tts.elevenlabs");
  });
});

/**
 * A channel section is all-or-nothing. Omitting it disables the channel, which is fine; what
 * is rejected is the in-between — dispatching with no callback registered, which strands every
 * gestión at `entrega: DISPATCHED` with no way to ever learn what happened to it.
 */
describe("webhookBaseUrl is required within its section", () => {
  const fonoster = {
    accessKeyId: "ak",
    apiKey: "key",
    apiSecret: "secret",
    webhookBaseUrl: "https://qcobro.example.com"
  };
  const twilio = {
    accountSid: "AC1",
    authToken: "tok",
    webhookBaseUrl: "https://qcobro.example.com"
  };

  it("accepts a fonoster section carrying a webhook base URL", () => {
    assert.equal(fonosterConfigSchema.parse(fonoster)?.webhookBaseUrl, fonoster.webhookBaseUrl);
  });

  it("rejects a fonoster section without one", () => {
    const withoutWebhook = { ...fonoster, webhookBaseUrl: undefined };
    assert.throws(() => fonosterConfigSchema.parse(withoutWebhook));
  });

  it("accepts a twilio section carrying a webhook base URL", () => {
    assert.equal(twilioConfigSchema.parse(twilio)?.webhookBaseUrl, twilio.webhookBaseUrl);
  });

  it("rejects a twilio section without one", () => {
    const withoutWebhook = { ...twilio, webhookBaseUrl: undefined };
    assert.throws(() => twilioConfigSchema.parse(withoutWebhook));
  });

  it("still allows both sections to be absent entirely — the channel is simply off", () => {
    assert.equal(fonosterConfigSchema.parse(undefined), undefined);
    assert.equal(twilioConfigSchema.parse(undefined), undefined);
  });
});
