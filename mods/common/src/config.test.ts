import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fonosterConfigSchema,
  voiceCatalogIdForVoice,
  twilioConfigSchema,
  type VoiceCatalogEntry
} from "./config.js";

const voices: VoiceCatalogEntry[] = [
  { id: "v-eleven", name: "Sofía", language: "es", gender: "female", provider: "elevenlabs" },
  { id: "v-google", name: "Andrés", language: "es", gender: "male", provider: "google" }
];

describe("voiceCatalogIdForVoice", () => {
  it("prefixes the voice id with its provider", () => {
    assert.equal(voiceCatalogIdForVoice("v-eleven", voices), "elevenlabs/v-eleven");
    assert.equal(voiceCatalogIdForVoice("v-google", voices), "google/v-google");
  });

  it("falls back to the elevenlabs provider for a voice outside the catalog", () => {
    assert.equal(voiceCatalogIdForVoice("missing", voices), "elevenlabs/missing");
  });

  it("strips the removed autopilot product refs from an old config", () => {
    const parsed = fonosterConfigSchema.parse({
      accessKeyId: "ak",
      apiKey: "key",
      apiSecret: "secret",
      autopilot: { sttProductRef: "stt.deepgram", sttModel: "nova-3", llmProductRef: "llm.google" }
    });
    assert.deepEqual(Object.keys(parsed?.autopilot ?? {}).sort(), [
      "evalsModel",
      "llmModel",
      "llmProvider",
      "maxTokens",
      "temperature"
    ]);
  });
});

/**
 * Twilio's section is all-or-nothing: dispatching with no status callback strands every
 * gestión at `delivery: DISPATCHED`. Fonoster's call results arrive through the signed
 * workspace webhook instead, so its `webhookBaseUrl` is optional and `webhookSecret` is what
 * the receiver needs.
 */
describe("channel webhook settings", () => {
  const fonoster = { accessKeyId: "ak", apiKey: "key", apiSecret: "secret" };
  const twilio = {
    accountSid: "AC1",
    authToken: "tok",
    webhookBaseUrl: "https://qcobro.example.com"
  };

  it("accepts a fonoster section with neither webhookBaseUrl nor webhookSecret", () => {
    const parsed = fonosterConfigSchema.parse(fonoster);
    assert.equal(parsed?.webhookBaseUrl, undefined);
    assert.equal(parsed?.webhookSecret, undefined);
  });

  it("keeps fonoster.webhookSecret and strips the removed recordingBaseUrl", () => {
    const parsed = fonosterConfigSchema.parse({
      ...fonoster,
      webhookSecret: "whsec_abc",
      recordingBaseUrl: "https://app.fonoster.com/api/recordings"
    });
    assert.equal(parsed?.webhookSecret, "whsec_abc");
    assert.equal("recordingBaseUrl" in (parsed ?? {}), false);
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
