# prerecorded-audio Specification

## Purpose

Defines the pre-recorded (`VOICE_PRERECORDED`) voice channel's own behavior: how a call's
outcome is recorded once it completes, the optional DTMF menu offered after the script
plays, and how the operator console lets an operator hear what actually happened on the
call. This capability owns only the pre-recorded channel's specifics — dispatching the
call is `channel-dispatch`, the delivery/path/outcome axes it writes are
`account-contact-log`, and the voice used to speak on a **live** call (`fonoster.voices` /
`ttsProductRefForVoice`) is configured in `agent-templates`, not here.

## Requirements

### Requirement: Pre-recorded call recording is played in the gestión detail

The Pre-grabada gestión detail SHALL play the **actual call recording** — resolved the
same way as Voz IA, from the call's Fonoster call record (the redacted copy), streamed through
`GET /api/gestiones/:id/recording` — never a synthesized stand-in for what was said on the
call. A recording resolves when the gestión has a `providerRef` and its call record has a
`recording` dialog entry the redacted copy doesn't withhold (`fonoster.recordingWithheld`).

The player SHALL be shown whenever a recording resolves, **regardless of `delivery`**. A
call that connected and played nothing (`delivery: FAILED`, `deliveryReason:
UNREACHABLE` — see "Pre-recorded call completion is recorded in-process") is exactly the
case an operator most needs to listen to; gating the player on `delivery: DELIVERED`
would hide the one recording most worth reviewing.

When no recording resolves (no `providerRef`, no call record, a record with no recording, or a
failed lookup), the detail SHALL show an explicit unavailable state rather than an empty or
broken player.

The platform SHALL NOT synthesize audio to represent what was said on a call. This
applies regardless of whether a recording is available — an unavailable recording is
shown as unavailable, never backfilled with a synthesized re-narration of the script.

#### Scenario: Operator plays the pre-recorded call's real recording

- **WHEN** the operator opens a pre-recorded gestión whose call record has a recording
- **THEN** an audio player is shown, playing the actual call recording

#### Scenario: Player shows even when the call didn't deliver

- **WHEN** the operator opens a pre-recorded gestión with `delivery: FAILED`,
  `deliveryReason: UNREACHABLE` (answered but the script never played), and a call record
  with a recording
- **THEN** the audio player is shown and plays the recording, unconditional on `delivery`

#### Scenario: No recording resolves

- **WHEN** the operator opens a pre-recorded gestión whose call record has no recording, or
  whose call record can't be found
- **THEN** the detail shows an explicit "recording unavailable" state instead of a player
- **AND** no audio is synthesized to fill the gap

### Requirement: Pre-recorded call completion is recorded in-process

The co-located pre-recorded VoiceServer (same container/process as the apiserver) SHALL speak
the script **non-interruptibly** (a callee talking over it never cuts it), and SHALL record
each pre-recorded call's result **in-process** on completion — without any HTTP callback endpoint,
in contrast to Voz IA, whose results arrive through the workspace webhook at
`/api/voice/events`. It SHALL correlate to the
gestión created when the call was placed (by call ref) and:

- setting the gestión `delivery` to `DELIVERED` when the call was **answered and the script played
  to completion**; to `FAILED` with a `deliveryReason` of `UNREACHABLE` when the call was answered
  but the script did **not** play (the verb chain failed or the session ended before playback
  finished); or to `FAILED` with a `deliveryReason` of `NO_ANSWER` when it rang out, `BUSY` when
  the line was busy, and `UNREACHABLE` or `PROVIDER_ERROR` when the call could not be placed;
- setting `path` to `ENGAGED` when the script played to the end **or** the template had a DTMF
  menu configured and the caller pressed a configured digit (see "Pre-recorded DTMF menu"), and
  additionally setting `outcome` to `OPT_OUT` when the digit pressed was the opt-out digit;
  leaving `path` and `outcome` null otherwise;
- writing the answered `durationSeconds` (answer → hangup; zero when never answered), including
  when the script did not play — the time on the line is real even when the message was not
  delivered;
- when billing is enabled, triggering usage settlement for the gestión's workspace using that
  answered duration, per the usage-ledger voice estimate→settle machinery.

Recording SHALL be idempotent per call ref: a completion processed more than once SHALL NOT
advance `delivery` a second time, duplicate the duration, settle twice, or overwrite an
already-recorded `path` or `outcome`.

`DELIVERED` SHALL mean that QCobro played the message out in full. It SHALL NOT assert that the
account holder listened to it. A call that was answered but played nothing SHALL NOT be reported
as `DELIVERED`, because answer alone is not evidence of contact — a network element may answer
and clear immediately, and a call may connect and then be stranded in silence.

`UNREACHABLE` is a transient `deliveryReason`, so an account whose script did not play SHALL
remain eligible for a further attempt under the campaign's retry rules.

#### Scenario: Answered pre-recorded call that plays in full is recorded and settled

- **WHEN** a pre-recorded call placed by QCobro is answered, the script plays to completion, and
  the call hangs up after 22 seconds with billing enabled
- **THEN** the correlated gestión `delivery` is `DELIVERED`, `durationSeconds` is 22, and usage is
  settled to the increment-billed amount for 22 answered seconds
- **AND** `path` is `ENGAGED` because the script played to the end
- **AND** `outcome` remains null when no opt-out digit was pressed

#### Scenario: Answered call that plays nothing is not reported as delivered

- **WHEN** a pre-recorded call is answered but the script never plays — the verb chain fails or
  the session ends before playback completes
- **THEN** the correlated gestión `delivery` is `FAILED` with `deliveryReason` `UNREACHABLE`
- **AND** `path` and `outcome` are null, because nothing was heard and nothing was pressed
- **AND** `durationSeconds` is the real answered duration, however brief or long
- **AND** the account remains eligible for a further attempt

#### Scenario: Unanswered pre-recorded call records a delivery failure and settles to zero

- **WHEN** a pre-recorded call is never answered
- **THEN** the correlated gestión `delivery` is `FAILED` with `deliveryReason` `NO_ANSWER`,
  `durationSeconds` is 0/absent, and any dispatch-time estimate is fully reversed to a net
  charge of zero

#### Scenario: Duplicate completion is idempotent

- **WHEN** the same pre-recorded call completion is processed twice for one call ref
- **THEN** exactly one `delivery` transition and one settlement exist for that call
- **AND** a `path`/`outcome` recorded by the first completion is preserved unchanged by the
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
  `outcome: OPT_OUT` (see "Pre-recorded call completion is recorded in-process").
- Any other digit, or the gather timing out with no digit, hangs up — identical to the behavior
  for a template with no menu. The script has still played to the end, so the gestión records
  `path: ENGAGED`; no `outcome` is recorded, because the caller chose nothing.

Reaching the menu at all means the script played in full, so `path` is `ENGAGED` for every
call that gets this far, whether or not a digit was pressed. `outcome: OPT_OUT` remains the
one axis gated on a specific press.

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
- **AND** the correlated gestión's `path` is set to `ENGAGED`

#### Scenario: Caller exhausts the repeat cap

- **WHEN** a template has `repeatDigit` `1` and `maxRepeats` 2, and the caller has already
  replayed the script twice
- **THEN** a further press of `1` hangs up instead of replaying again

#### Scenario: Caller opts out

- **WHEN** a template has `optOutDigit` `9`, `optOutConfirmationMessage` set, and the caller
  presses `9`
- **THEN** the confirmation message plays
- **AND** the call ends immediately afterward with no further gather
- **AND** the correlated gestión's `path` is set to `ENGAGED` and `outcome` is set to
  `OPT_OUT`

#### Scenario: Unrecognized digit or timeout hangs up

- **WHEN** a menu is configured and the caller presses a digit that matches neither configured
  digit, or the 5-second gather times out with no press
- **THEN** the call hangs up
- **AND** the correlated gestión's `path` is `ENGAGED`, because the script played to the end
- **AND** no `outcome` is recorded

### Requirement: Pre-recorded call hangs up when an answering machine is detected

The pre-recorded app runs answering-machine detection (AMD) with a 2000 ms window. When
the dispatched template's `hangupOnMachineDetected` (see `agent-templates`) is `true` —
the default — the co-located pre-recorded VoiceServer SHALL wait for the session's
`amd.result` (or the session's end) before speaking, for up to 9000 ms from session
start. When the verdict is `voicemail`, `machine` or `ivr`, the VoiceServer SHALL hang
up without speaking the script or offering any DTMF menu, so no part of the message is
left on a machine. When the verdict is anything else (`human`, `unknown`), or none
arrives within 9000 ms, the script plays, followed by the DTMF menu if one is
configured. When `hangupOnMachineDetected` is `false`, the script plays at once.

An AMD-detected hang-up SHALL be recorded through the same in-process completion path as
every other pre-recorded outcome (see "Pre-recorded call completion is recorded
in-process"): `delivery` `FAILED` with `deliveryReason` `UNREACHABLE` — the same pairing
already used for "answered but the script did not play" — additionally carrying `path`
`ANSWERED_BY_MACHINE` to distinguish a deliberate skip from a genuine playback failure.
`outcome` SHALL remain null; nothing was pressed. The answered `durationSeconds` SHALL
still be recorded, however brief. This reuses `UNREACHABLE`'s existing transient/retry
semantics unchanged — a machine-answered number remains eligible for a further attempt
under the campaign's retry rules, the same as any other unplayed script.

`hangupOnMachineDetected` defaults to `true` so that, once a workspace enables AMD
upstream, pre-recorded campaigns hang up on a detected machine without requiring every
existing template to be edited first.

#### Scenario: A detected machine hangs up before the script plays

- **WHEN** a `VOICE_PRERECORDED` call's `amd.result` is `voicemail`, `machine` or `ivr` and the template's
  `hangupOnMachineDetected` is `true` (the default)
- **THEN** the VoiceServer hangs up without speaking the script or gathering DTMF
- **AND** the gestión records `delivery: FAILED`, `deliveryReason: UNREACHABLE`,
  `path: ANSWERED_BY_MACHINE`, `outcome` null
- **AND** the answered `durationSeconds` is recorded

#### Scenario: A human-answered call is unaffected

- **WHEN** a `VOICE_PRERECORDED` call's `amd.result` is `human`, or none arrives within 9000 ms
- **THEN** the script plays and any configured DTMF menu is offered, exactly as before
  this capability existed

#### Scenario: No AMD verdict is available

- **WHEN** no `amd.result` arrives within 9000 ms of session start
- **THEN** the script plays and any configured DTMF menu is offered, exactly as before
  this capability existed

#### Scenario: A template opts out of hanging up on a detected machine

- **WHEN** the dispatched template's `hangupOnMachineDetected` is `false`
- **THEN** the script plays at once, without waiting for an `amd.result` (and any
  configured DTMF menu is offered)

#### Scenario: A machine-answered call remains eligible for retry

- **WHEN** a pre-recorded call is recorded with `path: ANSWERED_BY_MACHINE` via a
  detected-machine hang-up
- **THEN** the account remains eligible for a further attempt under the campaign's
  retry rules, identical to any other `UNREACHABLE` delivery failure
