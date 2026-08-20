## MODIFIED Requirements

### Requirement: Pre-recorded call completion is recorded in-process

The co-located pre-recorded VoiceServer (same container/process as the apiserver) SHALL record
each pre-recorded call's result **in-process** on completion — without any HTTP callback endpoint,
in contrast to the Voz IA autopilot, which posts to `/api/voice/events`. It SHALL correlate to the
gestión created when the call was placed (by call ref) and:

- setting the gestión `entrega` to `DELIVERED` when the call was **answered**, or to `FAILED`
  with a `deliveryReason` of `NO_ANSWER` when it rang out, `BUSY` when the line was busy, and
  `UNREACHABLE` or `PROVIDER_ERROR` when the call could not be placed;
- leaving `camino` and `resultado` null — a pre-recorded call has no inbound path and can
  observe no interaction;
- writing the answered `durationSeconds` (answer → hangup; zero when never answered);
- when billing is enabled, triggering usage settlement for the gestión's workspace using that
  answered duration, per the usage-ledger voice estimate→settle machinery.

Recording SHALL be idempotent per call ref: a completion processed more than once SHALL NOT
advance `entrega` a second time, duplicate the duration, or settle twice.

`DELIVERED` SHALL mean only that the call was answered; the system SHALL NOT assert playback of
the message to the account holder.

#### Scenario: Answered pre-recorded call is recorded and settled

- **WHEN** a pre-recorded call placed by QCobro is answered and later hangs up after 22 seconds
  and billing is enabled
- **THEN** the correlated gestión `entrega` is `DELIVERED`, `durationSeconds` is 22, and usage is
  settled to the increment-billed amount for 22 answered seconds
- **AND** `camino` and `resultado` remain null

#### Scenario: Unanswered pre-recorded call records a delivery failure and settles to zero

- **WHEN** a pre-recorded call is never answered
- **THEN** the correlated gestión `entrega` is `FAILED` with `deliveryReason` `NO_ANSWER`,
  `durationSeconds` is 0/absent, and any dispatch-time estimate is fully reversed to a net
  charge of zero

#### Scenario: Duplicate completion is idempotent

- **WHEN** the same pre-recorded call completion is processed twice for one call ref
- **THEN** exactly one `entrega` transition and one settlement exist for that call

#### Scenario: No HTTP callback endpoint is introduced

- **WHEN** a pre-recorded call completes
- **THEN** the result is recorded in-process by the co-located VoiceServer
- **AND** no external HTTP endpoint is required or exposed for pre-recorded completion
