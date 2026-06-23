import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ttsProductRefForVoice, type VoiceCatalogEntry } from "./config.js";

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
