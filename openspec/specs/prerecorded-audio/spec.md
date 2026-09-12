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

### Requirement: Pre-recorded call completion is recorded in-process

The co-located pre-recorded VoiceServer (same container/process as the apiserver) SHALL record
each pre-recorded call's result **in-process** on completion — without any HTTP callback endpoint,
in contrast to the Voz IA autopilot, which posts to `/api/voice/events`. It SHALL correlate to the
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

The co-located pre-recorded VoiceServer SHALL consult Fonoster's answering-machine
detection (AMD) verdict on the live call (`req.amd?.status`) before playing the script.
When the verdict is `MACHINE` and the dispatched template's
`hangupOnMachineDetected` (see `agent-templates`) is `true` — the default — the
VoiceServer SHALL hang up immediately, without speaking the script or offering any DTMF
menu. When the verdict is anything else (`HUMAN`, `UNKNOWN`, or absent because AMD was
not enabled for the call), or `hangupOnMachineDetected` is `false`, the call proceeds
exactly as before this capability — the script plays, followed by the DTMF menu if one
is configured.

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

- **WHEN** a `VOICE_PRERECORDED` call's live AMD verdict is `MACHINE` and the template's
  `hangupOnMachineDetected` is `true` (the default)
- **THEN** the VoiceServer hangs up without speaking the script or gathering DTMF
- **AND** the gestión records `delivery: FAILED`, `deliveryReason: UNREACHABLE`,
  `path: ANSWERED_BY_MACHINE`, `outcome` null
- **AND** the answered `durationSeconds` is recorded

#### Scenario: A human-answered call is unaffected

- **WHEN** a `VOICE_PRERECORDED` call's live AMD verdict is `HUMAN`
- **THEN** the script plays and any configured DTMF menu is offered, exactly as before
  this capability existed

#### Scenario: No AMD verdict is available

- **WHEN** AMD was not enabled for the call, so the live request carries no `amd` field
  at all
- **THEN** the script plays and any configured DTMF menu is offered, exactly as before
  this capability existed

#### Scenario: A template opts out of hanging up on a detected machine

- **WHEN** a `VOICE_PRERECORDED` call's live AMD verdict is `MACHINE`, but the
  dispatched template's `hangupOnMachineDetected` is `false`
- **THEN** the script plays (and any configured DTMF menu is offered) despite the
  `MACHINE` verdict

#### Scenario: A machine-answered call remains eligible for retry

- **WHEN** a pre-recorded call is recorded with `path: ANSWERED_BY_MACHINE` via a
  detected-machine hang-up
- **THEN** the account remains eligible for a further attempt under the campaign's
  retry rules, identical to any other `UNREACHABLE` delivery failure
