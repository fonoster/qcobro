import { config } from "../config.js";
import { readIntegrationApiKey } from "./fonosterIntegrations.js";

/**
 * Synthesize speech from text via ElevenLabs, used to preview a pre-recorded agent's
 * script as audio in the console (one-way pre-recorded gestiones have no captured
 * recording to play). The API key comes from `tts.apiKey`, else `ELEVENLABS_API_KEY`,
 * else the Fonoster integrations file (`tts.elevenlabs`); the model from `tts.model`.
 */
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string | null {
  return (
    config.tts?.apiKey ?? process.env.ELEVENLABS_API_KEY ?? readIntegrationApiKey("tts.elevenlabs")
  );
}

export function isTtsConfigured(): boolean {
  return !!getApiKey();
}

export async function synthesizeSpeech(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = getApiKey();
  if (!apiKey)
    throw new Error("ElevenLabs API key not configured (tts.apiKey / env / integrations)");
  const model = config.tts?.model ?? "eleven_multilingual_v2";

  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg"
    },
    body: JSON.stringify({ text, model_id: model })
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
