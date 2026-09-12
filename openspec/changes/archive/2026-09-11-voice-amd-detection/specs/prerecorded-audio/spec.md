## ADDED Requirements

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
