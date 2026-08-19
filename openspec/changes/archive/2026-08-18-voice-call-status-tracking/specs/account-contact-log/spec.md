## ADDED Requirements

### Requirement: Voice gestións are finalized from Fonoster call-status tracking

A `VOICE_PRERECORDED` or `VOICE_AI` gestión left at the dispatch-time `OTHER` placeholder outcome SHALL be finalized using Fonoster's call detail record (CDR) when the channel's own normal completion path (the co-located VoiceServer's in-process completion for `VOICE_PRERECORDED`; the autopilot `conversation.ended` webhook for `VOICE_AI`) does not resolve the gestión — most commonly because the call was never answered, or because it connected but the completion signal was lost.

Call-status tracking is started once per dispatch, immediately after the `OTHER` placeholder is
written, regardless of which dispatch path originated the call (campaign or manual/ad-hoc
outreach) and independent of whether the call ever reaches a channel-specific handler. The
system SHALL poll for the call's CDR until it becomes available (the CDR is written once, at
call end) or a bounded attempt budget is exhausted; a lookup before the call has ended SHALL NOT
be treated as a failure to deliver.

Once the CDR is available, the system SHALL finalize the gestión from it: `DELIVERED` (with
`durationSeconds` set to the CDR's real answered duration) when the CDR reflects a normal call
clearing; otherwise the channel's not-delivered equivalent (`NOT_DELIVERED` for
`VOICE_PRERECORDED`, per its existing binary DELIVERED/NOT_DELIVERED contract; `NO_ANSWER` for
`VOICE_AI`) with `durationSeconds` 0/absent. `DELIVERED` SHALL NOT be recorded with a fabricated
or zero duration. If the attempt budget is exhausted before the CDR becomes available, the
gestión SHALL be left unfinalized rather than guessed.

Finalization via call-status tracking SHALL be idempotent per gestión: once a gestión's outcome
has left the dispatch-time `OTHER` placeholder, tracking-based finalization SHALL NOT overwrite
it, regardless of the order in which the normal completion path and the CDR become available.

#### Scenario: Unanswered pre-recorded call is finalized from the CDR

- **WHEN** a `VOICE_PRERECORDED` call is dispatched, the VoiceServer's own completion never
  fires, and the call's CDR becomes available showing the call did not clear normally
- **THEN** the gestión `outcome` is set to `NOT_DELIVERED` with `durationSeconds` 0/absent

#### Scenario: Unanswered Voz IA call is finalized from the CDR

- **WHEN** a `VOICE_AI` call is dispatched, no `conversation.started`/`conversation.ended` event
  is ever received for that call, and the call's CDR becomes available showing the call did not
  clear normally
- **THEN** the gestión `outcome` is set to `NO_ANSWER` with `durationSeconds` 0/absent

#### Scenario: Answered call recovered when the normal completion path is lost

- **WHEN** the channel's own normal completion path does not finalize a gestión, and the call's
  CDR becomes available showing a normal call clearing
- **THEN** the system finalizes the gestión `outcome` as `DELIVERED` with `durationSeconds` set
  to the CDR's real answered duration

#### Scenario: A call still in progress does not finalize the gestión

- **WHEN** call-status tracking looks up a call's CDR before the call has ended
- **THEN** the gestión is not finalized from that lookup — tracking continues polling until
  either the CDR becomes available, the channel's normal completion path resolves it, or the
  attempt budget is exhausted

#### Scenario: Tracking-based finalization never overwrites an already-finalized outcome

- **WHEN** a gestión has already been finalized (its outcome has left the `OTHER` placeholder) by
  the channel's own normal completion path
- **THEN** a subsequently available CDR for the same call SHALL NOT modify the gestión's outcome
  or duration
