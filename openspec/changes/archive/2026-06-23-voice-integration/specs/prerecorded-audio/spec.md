## ADDED Requirements

### Requirement: Pre-recorded script is playable as audio

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

The deployment SHALL configure text-to-speech through an optional `tts` section in
`qcobro.json` (`provider` `elevenlabs`, `apiKey`, `model`). The API key MAY be omitted and
resolved from `ELEVENLABS_API_KEY` or the Fonoster integrations file; the voice is taken from
the deployment's `fonoster.voices` catalog. When the `tts` section and all fallbacks are
absent, synthesis is unavailable.

#### Scenario: Synthesis uses the configured provider and key

- **WHEN** `tts` is configured (or a key resolves from a fallback) and audio is requested for a
  script
- **THEN** the configured provider/model synthesizes the audio using the resolved key
