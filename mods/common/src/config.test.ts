import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fonosterConfigSchema,
  recordingUrlForCall,
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

describe("callTimeoutSeconds", () => {
  const fonoster = {
    accessKeyId: "ak",
    apiKey: "key",
    apiSecret: "secret",
    webhookBaseUrl: "https://qcobro.example.com"
  };

  it("defaults to 60s, well past the ~25s where recipients actually answer", () => {
    assert.equal(fonosterConfigSchema.parse(fonoster)?.callTimeoutSeconds, 60);
  });

  it("accepts a deployment override", () => {
    assert.equal(
      fonosterConfigSchema.parse({ ...fonoster, callTimeoutSeconds: 45 })?.callTimeoutSeconds,
      45
    );
  });

  it("rejects a value above Fonoster's own 120s ceiling", () => {
    assert.throws(() => fonosterConfigSchema.parse({ ...fonoster, callTimeoutSeconds: 180 }));
  });

  it("rejects zero — a call that can never ring is a configuration mistake", () => {
    assert.throws(() => fonosterConfigSchema.parse({ ...fonoster, callTimeoutSeconds: 0 }));
  });
});

describe("recordingUrlForCall", () => {
  const baseUrl = "https://app.fonoster.com/api/recordings";

  it("appends the provider call ref to the base URL", () => {
    assert.equal(
      recordingUrlForCall("c21ff1ab-5b46-4d99-8879-fad1e1d02d0a", baseUrl),
      "https://app.fonoster.com/api/recordings/c21ff1ab-5b46-4d99-8879-fad1e1d02d0a.wav"
    );
  });

  it("tolerates a trailing slash on the configured base", () => {
    assert.equal(
      recordingUrlForCall("ref1", "https://app.fonoster.com/api/recordings/"),
      "https://app.fonoster.com/api/recordings/ref1.wav"
    );
  });

  it("returns undefined when no base URL is configured, so callers can fall back", () => {
    assert.equal(recordingUrlForCall("call-ref", undefined), undefined);
    assert.equal(recordingUrlForCall("call-ref", null), undefined);
  });

  it("returns undefined when the gestión never reached a provider", () => {
    assert.equal(recordingUrlForCall(null, baseUrl), undefined);
    assert.equal(recordingUrlForCall("", baseUrl), undefined);
  });

  it("percent-encodes the ref so an odd one cannot break out of the path", () => {
    assert.equal(
      recordingUrlForCall("a b/../c", baseUrl),
      "https://app.fonoster.com/api/recordings/a%20b%2F..%2Fc.wav"
    );
  });
});
