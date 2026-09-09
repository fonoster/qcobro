## Why

The pre-recorded gestión detail played an ElevenLabs re-synthesis of the agent's script
text, not the call itself — an operator listening to "what happened on the call" was
actually hearing a fresh TTS narration that could drift from the real audio (a failed
verb, a DTMF menu, background noise, silence) and never reflected it. The call recording
already exists (Fonoster records every call via `MixMonitor`) and is already resolved
server-side for both voice channels via `resolveRecordingUrl`. The console should play
that, and the TTS-for-playback subsystem it replaces (`GET /api/voice/tts`, the
ElevenLabs client, the bounded LRU cache, `config.tts`) should not exist to be a source
of drift, cost, or confusion with the separate, still-needed live-call voice (the
Fonoster AUTOPILOT `productRef`, driven by `ttsProductRefForVoice`).

## What Changes

- Pre-recorded gestión detail now plays the real call recording (`recordingUrl`,
  resolved from `channelData.recordingFile`/`recordingUrl`), exactly like Voz IA, instead
  of a synthesized re-narration of the script.
- **BREAKING**: `GET /api/voice/tts` is removed, along with the ElevenLabs TTS client,
  the synthesized-audio LRU cache, and the `tts` section of `qcobro.json`. Any deployment
  configuring `tts.*` in `qcobro.json` will have that section rejected as an unknown key
  is no longer a concern (the field is simply dropped from the schema — extra keys are
  not validated against, so this is inert rather than a hard failure, but it no longer
  does anything).
- The pre-recorded detail's script card is kept (retitled "Guion reproducido"/"Played
  script") as a text record of what was sent, no longer presented as playable audio.
- Spec: `prerecorded-audio` drops its three TTS-playback requirements and gains one
  requirement describing the real-recording player, including an explicit prohibition on
  synthesizing audio to represent what was said on a call.
- Spec: `web-console`'s channel-aware detail requirement is reworded so pre-recorded is
  no longer described as offering a "replayable synthesized script"; also fixes a stale
  scenario asserting a `Camino` label that doesn't match the code's actual rendered text.
- Docs: `DELIVERABILITY.md` §4 is corrected to state pre-recorded now has an audio player
  (the real recording) and no longer synthesizes speech.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `prerecorded-audio`: replace "Pre-recorded script is playable as audio" / "TTS provider
  is configured in qcobro.json" / "Synthesized audio cache is bounded" with a single
  requirement that the detail plays the resolved call recording and never synthesizes
  audio to represent what was said.
- `web-console`: reword the "Channel-aware Detalle de gestión" requirement's one-way
  message description of `VOICE_PRERECORDED` (real recording, not a replayable
  synthesized script) and fix its stale `Camino` label scenario.

## Impact

- Code (already shipped on this branch, ahead of this spec sync): `GestionDetail.tsx`,
  `mods/apiserver/src/index.ts`, `elevenLabsTts.ts`/`ttsCache.ts` (deleted),
  `mods/common/src/config.ts` (`tts` schema removed), `config/qcobro.example.json`,
  `README.md`.
- Docs: `DELIVERABILITY.md` (updated directly, not an OpenSpec artifact).
- No database or API contract changes beyond the removed `GET /api/voice/tts` route.
