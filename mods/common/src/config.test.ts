import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fonosterConfigSchema,
  recordingFileNameForCall,
  recordingUrlForFile,
  resolveRecordingUrl,
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

describe("recordingFileNameForCall", () => {
  it("names the file the way Fonoster's dialplan records it: appRef_mediaSessionRef.wav", () => {
    assert.equal(
      recordingFileNameForCall("7acb5d67-c660-49c4-af34-07bcc718683c", "1756742400.123"),
      "7acb5d67-c660-49c4-af34-07bcc718683c_1756742400.123.wav"
    );
  });

  it("returns undefined when either half is missing", () => {
    assert.equal(recordingFileNameForCall(undefined, "1756742400.123"), undefined);
    assert.equal(recordingFileNameForCall("app-ref", undefined), undefined);
    assert.equal(recordingFileNameForCall("", "1756742400.123"), undefined);
    assert.equal(recordingFileNameForCall("app-ref", ""), undefined);
  });
});

describe("recordingUrlForFile", () => {
  const baseUrl = "https://app.fonoster.com/api/recordings";

  it("appends the recording's file name to the base URL", () => {
    assert.equal(
      recordingUrlForFile("app-ref_1756742400.123.wav", baseUrl),
      "https://app.fonoster.com/api/recordings/app-ref_1756742400.123.wav"
    );
  });

  it("tolerates a trailing slash on the configured base", () => {
    assert.equal(
      recordingUrlForFile("rec1.wav", "https://app.fonoster.com/api/recordings/"),
      "https://app.fonoster.com/api/recordings/rec1.wav"
    );
  });

  it("returns undefined when no base URL is configured, so callers can fall back", () => {
    assert.equal(recordingUrlForFile("rec1.wav", undefined), undefined);
    assert.equal(recordingUrlForFile("rec1.wav", null), undefined);
  });

  it("returns undefined when the gestión recorded no file name", () => {
    assert.equal(recordingUrlForFile(null, baseUrl), undefined);
    assert.equal(recordingUrlForFile("", baseUrl), undefined);
  });

  it("percent-encodes the name so an odd one cannot break out of the path", () => {
    assert.equal(
      recordingUrlForFile("a b/../c.wav", baseUrl),
      "https://app.fonoster.com/api/recordings/a%20b%2F..%2Fc.wav"
    );
  });
});

describe("resolveRecordingUrl", () => {
  const baseUrl = "https://app.fonoster.com/api/recordings";

  it("uses the URL Voz IA reported, exactly as reported", () => {
    const reported = "https://rec.example/api/recordings/app-1_1756742400.123.wav";
    assert.equal(resolveRecordingUrl({ recordingUrl: reported }, baseUrl), reported);
  });

  it("never overrides a reported URL with a locally composed one", () => {
    // The regression this guards: a configured base URL used to win over the provider's
    // own answer, replacing a working Voz IA recording link with one that 404s.
    const reported = "https://rec.example/api/recordings/app-1_1756742400.123.wav";
    assert.equal(
      resolveRecordingUrl({ recordingUrl: reported, recordingFile: "other.wav" }, baseUrl),
      reported
    );
  });

  it("composes a pre-recorded gestión's URL from its file name and the deployment base", () => {
    assert.equal(
      resolveRecordingUrl({ recordingFile: "app-1_1756742400.123.wav" }, baseUrl),
      "https://app.fonoster.com/api/recordings/app-1_1756742400.123.wav"
    );
  });

  it("returns undefined when the gestión reported no recording at all", () => {
    assert.equal(resolveRecordingUrl({}, baseUrl), undefined);
    assert.equal(resolveRecordingUrl(null, baseUrl), undefined);
    assert.equal(resolveRecordingUrl(undefined, baseUrl), undefined);
  });

  it("returns undefined for a pre-recorded gestión when no base URL is configured", () => {
    assert.equal(resolveRecordingUrl({ recordingFile: "app-1_x.wav" }, undefined), undefined);
  });

  it("ignores non-string channelData values rather than rendering them", () => {
    assert.equal(
      resolveRecordingUrl({ recordingUrl: 42, recordingFile: null }, baseUrl),
      undefined
    );
  });
});
