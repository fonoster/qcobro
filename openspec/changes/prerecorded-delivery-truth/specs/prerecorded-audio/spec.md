## MODIFIED Requirements

### Requirement: Pre-recorded call completion is recorded in-process

The co-located pre-recorded VoiceServer (same container/process as the apiserver) SHALL record
each pre-recorded call's result **in-process** on completion — without any HTTP callback endpoint,
in contrast to the Voz IA autopilot, which posts to `/api/voice/events`. It SHALL correlate to the
gestión created when the call was placed (by call ref) and:

- setting the gestión `entrega` to `DELIVERED` when the call was **answered and the script played
  to completion**; to `FAILED` with a `deliveryReason` of `UNREACHABLE` when the call was answered
  but the script did **not** play (the verb chain failed or the session ended before playback
  finished); or to `FAILED` with a `deliveryReason` of `NO_ANSWER` when it rang out, `BUSY` when
  the line was busy, and `UNREACHABLE` or `PROVIDER_ERROR` when the call could not be placed;
- setting `camino` to `ENGAGED` when the script played to the end **or** the template had a DTMF
  menu configured and the caller pressed a configured digit (see "Pre-recorded DTMF menu"), and
  additionally setting `resultado` to `OPT_OUT` when the digit pressed was the opt-out digit;
  leaving `camino` and `resultado` null otherwise;
- writing the answered `durationSeconds` (answer → hangup; zero when never answered), including
  when the script did not play — the time on the line is real even when the message was not
  delivered;
- when billing is enabled, triggering usage settlement for the gestión's workspace using that
  answered duration, per the usage-ledger voice estimate→settle machinery.

Recording SHALL be idempotent per call ref: a completion processed more than once SHALL NOT
advance `entrega` a second time, duplicate the duration, settle twice, or overwrite an
already-recorded `camino` or `resultado`.

`DELIVERED` SHALL mean that QCobro played the message out in full. It SHALL NOT assert that the
account holder listened to it. A call that was answered but played nothing SHALL NOT be reported
as `DELIVERED`, because answer alone is not evidence of contact — a network element may answer
and clear immediately, and a call may connect and then be stranded in silence.

`UNREACHABLE` is a transient `deliveryReason`, so an account whose script did not play SHALL
remain eligible for a further attempt under the campaign's retry rules.

#### Scenario: Answered pre-recorded call that plays in full is recorded and settled

- **WHEN** a pre-recorded call placed by QCobro is answered, the script plays to completion, and
  the call hangs up after 22 seconds with billing enabled
- **THEN** the correlated gestión `entrega` is `DELIVERED`, `durationSeconds` is 22, and usage is
  settled to the increment-billed amount for 22 answered seconds
- **AND** `camino` is `ENGAGED` because the script played to the end
- **AND** `resultado` remains null when no opt-out digit was pressed

#### Scenario: Answered call that plays nothing is not reported as delivered

- **WHEN** a pre-recorded call is answered but the script never plays — the verb chain fails or
  the session ends before playback completes
- **THEN** the correlated gestión `entrega` is `FAILED` with `deliveryReason` `UNREACHABLE`
- **AND** `camino` and `resultado` are null, because nothing was heard and nothing was pressed
- **AND** `durationSeconds` is the real answered duration, however brief or long
- **AND** the account remains eligible for a further attempt

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
