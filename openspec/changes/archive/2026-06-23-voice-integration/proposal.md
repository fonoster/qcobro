## Why

Two Voz IA / pre-recorded behaviors were built quickly for a demo and now need to be
permanent and specified: (1) QCobro registers the Fonoster autopilot **events-hook** when it
syncs a Voz IA agent, so conversation events return as gestiones; and (2) the console plays
**synthesized audio** of a pre-recorded agent's script (one-way pre-recorded gestiones have
no captured recording to play). Both currently work but lacked specs and proper config.

## What Changes

- **Voz IA events-hook registration** (encode existing behavior): when `fonoster.webhookBaseUrl`
  is configured, syncing a Voz IA agent registers the autopilot events-hook at
  `<webhookBaseUrl>/api/voice/events` subscribed to all conversation events; when unset, no
  hook is registered.
- **Pre-recorded script audio** (make permanent): the Pre-grabada gestión detail plays audio
  of the script synthesized via a configured TTS provider (ElevenLabs). Adds an optional
  `tts` section to `qcobro.json` (`provider`, `apiKey`, `model`); the key falls back to
  `ELEVENLABS_API_KEY` / the Fonoster integrations file, and when no key resolves the player
  is gracefully unavailable. Removed the "TEMPORARY/demo" framing and the smoke-test script.

## Capabilities

### New Capabilities

- `voice-events-hook`: registering the Fonoster autopilot events-hook from
  `fonoster.webhookBaseUrl` during Voz IA agent sync, so `conversation.started` /
  `conversation.ended` return to `POST /api/voice/events`.
- `prerecorded-audio`: synthesizing and playing a pre-recorded agent's script as audio in the
  console via a configured TTS provider, with graceful absence when TTS is unconfigured.

### Modified Capabilities

- _None._

## Impact

- **`@qcobro/common` config**: new optional `tts` section (Zod schema); `fonoster.webhookBaseUrl`
  already exists.
- **`mods/apiserver`**: TTS service reads `tts.apiKey`/`tts.model` (fallback env/integrations);
  `GET /api/voice/tts` endpoint (cached) is now a supported route; voice-app sync registers the
  events-hook. Removed `scripts/smoke-insight.ts`.
- **`mods/webapp`**: Pre-grabada detail plays the synthesized audio via the `/api` proxy.
- **Security/cost**: synthesizing sends the script text to ElevenLabs (a configured provider);
  the events-hook endpoint remains unauthenticated (tracked follow-up).
