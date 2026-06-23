import { readIntegrationApiKey } from "./fonosterIntegrations.js";

/**
 * TEMPORARY (demo only): synthesize speech from text via ElevenLabs, so the
 * Pre-grabada gestión detail can play a real recording of the script. Not wired into
 * the call path — purely for the demo player. Remove once real recordings are captured.
 *
 * The API key is taken from `ELEVENLABS_API_KEY`, else the Fonoster integrations file
 * (`tts.elevenlabs`).
 */
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY ?? readIntegrationApiKey("tts.elevenlabs");
}

export function isTtsConfigured(): boolean {
  return !!getApiKey();
}

export async function synthesizeSpeech(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ElevenLabs API key not found (env or integrations.json)");

  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg"
    },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" })
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
