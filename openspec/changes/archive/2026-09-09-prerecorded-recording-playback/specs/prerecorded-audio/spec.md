## REMOVED Requirements

### Requirement: Pre-recorded script is playable as audio

**Reason**: Replaced by "Pre-recorded call recording is played in the gestión detail"
below. The console used to synthesize the script text on demand via ElevenLabs and play
that instead of the call — a re-narration that could drift from what actually happened
on the call (a failed verb, a DTMF menu, silence). The real call recording already
exists and is already resolved server-side for both voice channels; the console now
plays that instead of synthesizing a stand-in for it.

**Migration**: No data migration. `GET /api/voice/tts` no longer exists; the gestión
detail's recording player already reads `recordingUrl` instead.

The console SHALL let the operator play a pre-recorded agent's script as audio in the
Pre-grabada gestión detail. The audio SHALL be synthesized on demand from the script text via
the configured TTS provider and cached, since one-way pre-recorded gestiones capture no call
recording. When TTS is not configured, the detail SHALL degrade gracefully (no playable
audio) without error.

#### Scenario: Operator plays the pre-recorded script

- **WHEN** the operator opens a pre-recorded gestión that has a script and TTS is configured
- **THEN** an audio player is shown that plays speech synthesized from the script

#### Scenario: Graceful when TTS is not configured

- **WHEN** TTS is not configured (no resolvable API key)
- **THEN** the request for synthesized audio fails cleanly and the detail shows no playable
  audio, without breaking the page

### Requirement: TTS provider is configured in qcobro.json

**Reason**: The TTS-for-playback subsystem this configured (`GET /api/voice/tts`, the
ElevenLabs client, the synthesized-audio cache) has been removed in its entirety — see
"Pre-recorded script is playable as audio" above.

**Migration**: Remove any `tts` section from `qcobro.json`; it is no longer read.
`ELEVENLABS_API_KEY` is no longer consulted by this route (it never affects
`fonoster.voices` or the live-call voice path, which is unrelated and unaffected).

The deployment SHALL configure text-to-speech through an optional `tts` section in
`qcobro.json` (`provider` `elevenlabs`, `apiKey`, `model`, `maxTextLength`,
`cache.maxEntries`, `cache.maxBytes`). The API key MAY be supplied via
the `ELEVENLABS_API_KEY` environment variable instead of `tts.apiKey`; the voice is taken
from the deployment's `fonoster.voices` catalog. When neither the `tts` key nor the
environment fallback resolves, synthesis is unavailable.

#### Scenario: Synthesis uses the configured provider and key

- **WHEN** `tts` is configured (or a key resolves from a fallback) and audio is requested for a
  script
- **THEN** the configured provider/model synthesizes the audio using the resolved key

### Requirement: Synthesized audio cache is bounded

**Reason**: The cache existed only to bound the cost/memory of the synthesis pipeline
removed by "Pre-recorded script is playable as audio" above; with no synthesis, there is
nothing left to cache.

**Migration**: None. The in-memory cache and its bounds no longer exist.

The in-memory cache of synthesized audio (keyed by voice + text) SHALL be bounded by
both a maximum entry count and a maximum total byte budget, configurable via
`tts.cache.maxEntries`/`tts.cache.maxBytes` in `qcobro.json` (see "TTS provider is
configured in qcobro.json"). When either limit would be exceeded, the least-recently-used
entry SHALL be evicted first, repeated until both limits are satisfied. A cache hit SHALL
refresh the entry's recency. A single item larger than the whole byte budget SHALL NOT be
cached, but SHALL still be synthesized and served for that request.

The `text` query parameter accepted for synthesis SHALL be capped at
`tts.maxTextLength` characters (configurable in `qcobro.json`); a request over the limit
SHALL be rejected with `400` before any call to the TTS provider.

#### Scenario: Cache evicts least-recently-used entries under either limit

- **WHEN** caching a new synthesized audio item would exceed the configured entry-count or
  byte-budget limit
- **THEN** the least-recently-used cached entry is evicted first, repeated until both limits
  are satisfied

#### Scenario: A cache hit refreshes recency

- **WHEN** a previously cached voice+text pair is requested again before being evicted
- **THEN** it is served from cache
- **AND** it becomes the most-recently-used entry, making it the last to be evicted next

#### Scenario: An oversized single item is not cached but is still served

- **WHEN** a synthesized audio item is larger than the configured total byte budget
- **THEN** it is not added to the cache
- **AND** it is still synthesized and returned to the caller for that request

#### Scenario: Over-long text is rejected before synthesis

- **WHEN** the `text` query parameter exceeds the configured `tts.maxTextLength`
- **THEN** the request is rejected with `400` and no call is made to the TTS provider

## ADDED Requirements

### Requirement: Pre-recorded call recording is played in the gestión detail

The Pre-grabada gestión detail SHALL play the **actual call recording** — resolved the
same way as Voz IA, from `channelData.recordingFile` (composed against the deployment's
recording base URL) or a directly reported `channelData.recordingUrl` — never a
synthesized stand-in for what was said on the call.

The player SHALL be shown whenever a recording resolves, **regardless of `delivery`**. A
call that connected and played nothing (`delivery: FAILED`, `deliveryReason:
UNREACHABLE` — see "Pre-recorded call completion is recorded in-process") is exactly the
case an operator most needs to listen to; gating the player on `delivery: DELIVERED`
would hide the one recording most worth reviewing.

When no recording resolves (no `recordingFile`/`recordingUrl` on the gestión, or no
`recordingBaseUrl` configured for the deployment), the detail SHALL show an explicit
unavailable state rather than an empty or broken player.

The platform SHALL NOT synthesize audio to represent what was said on a call. This
applies regardless of whether a recording is available — an unavailable recording is
shown as unavailable, never backfilled with a synthesized re-narration of the script.

#### Scenario: Operator plays the pre-recorded call's real recording

- **WHEN** the operator opens a pre-recorded gestión whose `recordingUrl` resolves
- **THEN** an audio player is shown, playing the actual call recording

#### Scenario: Player shows even when the call didn't deliver

- **WHEN** the operator opens a pre-recorded gestión with `delivery: FAILED`,
  `deliveryReason: UNREACHABLE` (answered but the script never played), and a
  `recordingUrl` that resolves
- **THEN** the audio player is shown and plays the recording, unconditional on `delivery`

#### Scenario: No recording resolves

- **WHEN** the operator opens a pre-recorded gestión with no `recordingFile`/`recordingUrl`
  on the gestión, or no `recordingBaseUrl` configured for the deployment
- **THEN** the detail shows an explicit "recording unavailable" state instead of a player
- **AND** no audio is synthesized to fill the gap
