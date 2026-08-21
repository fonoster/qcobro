## MODIFIED Requirements

### Requirement: Pre-recorded call completion is recorded in-process

The co-located pre-recorded VoiceServer (same container/process as the apiserver) SHALL record
each pre-recorded call's result **in-process** on completion — without any HTTP callback endpoint,
in contrast to the Voz IA autopilot, which posts to `/api/voice/events`. It SHALL correlate to the
gestión created when the call was placed (by call ref) and:

- setting the gestión `entrega` to `DELIVERED` when the call was **answered**, or to `FAILED`
  with a `deliveryReason` of `NO_ANSWER` when it rang out, `BUSY` when the line was busy, and
  `UNREACHABLE` or `PROVIDER_ERROR` when the call could not be placed;
- leaving `camino` null always, and leaving `resultado` null **unless** the template had a DTMF
  menu configured and the caller pressed the opt-out digit (see "Pre-recorded DTMF menu"), in
  which case `resultado` is `OPT_OUT`;
- writing the answered `durationSeconds` (answer → hangup; zero when never answered);
- when billing is enabled, triggering usage settlement for the gestión's workspace using that
  answered duration, per the usage-ledger voice estimate→settle machinery.

Recording SHALL be idempotent per call ref: a completion processed more than once SHALL NOT
advance `entrega` a second time, duplicate the duration, settle twice, or overwrite an already
-recorded `resultado`.

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
- **AND** a `resultado` recorded by the first completion is preserved unchanged by the second

## ADDED Requirements

### Requirement: Pre-recorded DTMF menu

The VoiceServer SHALL offer a DTMF menu after the script when a `VOICE_PRERECORDED` template
has `repeatDigit` and/or `optOutDigit` configured (see `agent-templates`): it plays the script,
then plays whichever of `repeatMessage`/`optOutMessage` are set, then gathers a single DTMF
digit (`response.gather({ source: DTMF, maxDigits: 1, timeout })`) before hanging up. A template
with neither digit configured SHALL NOT gather at all — the call flow, cost, and billed
duration are unchanged from before this capability.

Digit handling:

- Pressing `repeatDigit` (while the per-call replay count is below `maxRepeats`, default 2)
  replays the script and, since a menu is configured, gathers again afterward.
- Pressing `repeatDigit` at or beyond `maxRepeats` hangs up, identically to an unrecognized
  digit.
- Pressing `optOutDigit` ends the call immediately (no further gather) and marks the
  completion so the gestión records `resultado: OPT_OUT` (see "Pre-recorded call completion is
  recorded in-process").
- Any other digit, or the gather timing out with no digit, hangs up — identical to today's
  behavior for a template with no menu.

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

#### Scenario: Caller exhausts the repeat cap

- **WHEN** a template has `repeatDigit` `1` and `maxRepeats` 2, and the caller has already
  replayed the script twice
- **THEN** a further press of `1` hangs up instead of replaying again

#### Scenario: Caller opts out

- **WHEN** a template has `optOutDigit` `9` and the caller presses `9`
- **THEN** the call ends immediately with no further gather
- **AND** the correlated gestión's `resultado` is set to `OPT_OUT`

#### Scenario: Unrecognized digit or timeout hangs up

- **WHEN** a menu is configured and the caller presses a digit that matches neither configured
  digit, or the gather times out with no press
- **THEN** the call hangs up, and no `resultado` is recorded
