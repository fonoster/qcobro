# prerecorded-audio Specification

## Purpose

TBD - created by archiving change voice-integration. Update Purpose after archive.

## Requirements

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
`qcobro.json` (`provider` `elevenlabs`, `apiKey`, `model`). The API key MAY be supplied via
the `ELEVENLABS_API_KEY` environment variable instead of `tts.apiKey`; the voice is taken
from the deployment's `fonoster.voices` catalog. When neither the `tts` key nor the
environment fallback resolves, synthesis is unavailable.

#### Scenario: Synthesis uses the configured provider and key

- **WHEN** `tts` is configured (or a key resolves from a fallback) and audio is requested for a
  script
- **THEN** the configured provider/model synthesizes the audio using the resolved key

### Requirement: Pre-recorded call completion is recorded in-process

The co-located pre-recorded VoiceServer (same container/process as the apiserver) SHALL record
each pre-recorded call's result **in-process** on completion — without any HTTP callback endpoint,
in contrast to the Voz IA autopilot, which posts to `/api/voice/events`. It SHALL correlate to the
gestión created when the call was placed (by call ref) and:

- setting the gestión `entrega` to `DELIVERED` when the call was **answered**, or to `FAILED`
  with a `deliveryReason` of `NO_ANSWER` when it rang out, `BUSY` when the line was busy, and
  `UNREACHABLE` or `PROVIDER_ERROR` when the call could not be placed;
- leaving `camino` and `resultado` null **unless** the template had a DTMF menu configured and
  the caller pressed a configured digit (see "Pre-recorded DTMF menu"): pressing either digit
  sets `camino` to `ENGAGED`; pressing the opt-out digit additionally sets `resultado` to
  `OPT_OUT`;
- writing the answered `durationSeconds` (answer → hangup; zero when never answered);
- when billing is enabled, triggering usage settlement for the gestión's workspace using that
  answered duration, per the usage-ledger voice estimate→settle machinery.

Recording SHALL be idempotent per call ref: a completion processed more than once SHALL NOT
advance `entrega` a second time, duplicate the duration, settle twice, or overwrite an
already-recorded `camino` or `resultado`.

`DELIVERED` SHALL mean only that the call was answered; the system SHALL NOT assert playback of
the message to the account holder.

#### Scenario: Answered pre-recorded call is recorded and settled

- **WHEN** a pre-recorded call placed by QCobro is answered and later hangs up after 22 seconds
  and billing is enabled
- **THEN** the correlated gestión `entrega` is `DELIVERED`, `durationSeconds` is 22, and usage is
  settled to the increment-billed amount for 22 answered seconds
- **AND** `camino` and `resultado` remain null when no DTMF menu was configured

#### Scenario: Unanswered pre-recorded call records a delivery failure and settles to zero

- **WHEN** a pre-recorded call is never answered
- **THEN** the correlated gestión `entrega` is `FAILED` with `deliveryReason` `NO_ANSWER`,
  `durationSeconds` is 0/absent, and any dispatch-time estimate is fully reversed to a net
  charge of zero

#### Scenario: Duplicate completion is idempotent

- **WHEN** the same pre-recorded call completion is processed twice for one call ref
- **THEN** exactly one `entrega` transition and one settlement exist for that call
- **AND** a `camino`/`resultado` recorded by the first completion is preserved unchanged by the
  second

#### Scenario: No HTTP callback endpoint is introduced

- **WHEN** a pre-recorded call completes
- **THEN** the result is recorded in-process by the co-located VoiceServer
- **AND** no external HTTP endpoint is required or exposed for pre-recorded completion

### Requirement: Pre-recorded DTMF menu

The VoiceServer SHALL offer a DTMF menu after the script when a `VOICE_PRERECORDED` template
has `repeatDigit` and/or `optOutDigit` configured (see `agent-templates`): it plays the script,
then plays whichever of `repeatMessage`/`optOutMessage` are set, then gathers a single DTMF
digit with a 5-second timeout (`response.gather({ source: DTMF, maxDigits: 1, timeout: 5 })`)
before hanging up. A template with neither digit configured SHALL NOT gather at all — the call
flow, cost, and billed duration are unchanged from before this capability.

Digit handling:

- Pressing `repeatDigit` (while the per-call replay count is below `maxRepeats`, default 2)
  replays the script, marks the call as having engaged (see below), and gathers again
  afterward.
- Pressing `repeatDigit` at or beyond `maxRepeats` hangs up, identically to an unrecognized
  digit.
- Pressing `optOutDigit` plays `optOutConfirmationMessage` (when configured — required
  whenever `optOutDigit` is set, see `agent-templates`), then ends the call (no further
  gather), marks the call as having engaged, and marks the completion so the gestión records
  `resultado: OPT_OUT` (see "Pre-recorded call completion is recorded in-process").
- **Any** configured-digit press (repeat or opt-out) marks the completion so the gestión
  records `camino: ENGAGED` — pressing a digit at all is treated as engagement, regardless of
  which digit or how many times.
- Any other digit, or the gather timing out with no digit, hangs up — identical to today's
  behavior for a template with no menu; no `camino` or `resultado` is recorded.

The platform SHALL NOT synthesize, translate, or number the spoken options — `repeatMessage`
and `optOutMessage` are the complete, operator-authored spoken text for each option.

#### Scenario: No menu configured — behavior is unchanged

- **WHEN** a `VOICE_PRERECORDED` template has neither `repeatDigit` nor `optOutDigit` set
- **THEN** the call plays the script and hangs up with no gather, exactly as before this
  capability existed

#### Scenario: Caller replays the script within the cap

- **WHEN** a template has `repeatDigit` `1` and `maxRepeats` 2, and the caller presses `1`
  once after the script plays
- **THEN** the script plays again
- **AND** the VoiceServer gathers once more afterward
- **AND** the correlated gestión's `camino` is set to `ENGAGED`

#### Scenario: Caller exhausts the repeat cap

- **WHEN** a template has `repeatDigit` `1` and `maxRepeats` 2, and the caller has already
  replayed the script twice
- **THEN** a further press of `1` hangs up instead of replaying again

#### Scenario: Caller opts out

- **WHEN** a template has `optOutDigit` `9`, `optOutConfirmationMessage` set, and the caller
  presses `9`
- **THEN** the confirmation message plays
- **AND** the call ends immediately afterward with no further gather
- **AND** the correlated gestión's `camino` is set to `ENGAGED` and `resultado` is set to
  `OPT_OUT`

#### Scenario: Unrecognized digit or timeout hangs up

- **WHEN** a menu is configured and the caller presses a digit that matches neither configured
  digit, or the 5-second gather times out with no press
- **THEN** the call hangs up
- **AND** no `camino` or `resultado` is recorded
