## MODIFIED Requirements

### Requirement: Dispatch lifecycle is recorded with latency and error class

For every dispatch the engine attempts, the stream SHALL contain an `attempt.reserved`
event followed by `dispatch.requested`, and then either `dispatch.succeeded` (with the
provider ref and latency) or `dispatch.failed` (with latency, an error class, and the error
message). The error class SHALL be the dispatch failure's real `DispatchError.kind`
(`DELIVERY_REJECTED` or `SYSTEM_ERROR`), not a generic constructor name. Recipient identifiers
in dispatch events SHALL be masked; rendered message bodies, scripts, and transcripts SHALL NOT
be stored in the stream.

#### Scenario: Failed dispatch is recorded, not just logged

- **WHEN** a channel client throws during dispatch
- **THEN** the stream contains a `dispatch.failed` event for that account with the error
  class and message, and the corresponding `account.decided` event records
  `dispatch_failed`

#### Scenario: Error class reflects the real failure kind

- **WHEN** a dispatch fails with a `DispatchError` whose `kind` is `SYSTEM_ERROR`
- **THEN** the `dispatch.failed` event's error class is `SYSTEM_ERROR`, not `"Error"`

#### Scenario: No message content in the stream

- **WHEN** any dispatch event is persisted
- **THEN** it contains no rendered message body, script, or transcript, and the recipient
  identifier is masked

## ADDED Requirements

### Requirement: Circuit-breaker trips are recorded as campaign.autopaused events

The stream SHALL persist a `campaign.autopaused` event, carrying the campaign id, workspace
ref, the triggering error kind, and the consecutive-failure count that tripped it, whenever the
engine's consecutive-system-error circuit breaker transitions a campaign to `PAUSED`.

#### Scenario: An auto-pause is recorded

- **WHEN** the engine auto-pauses a campaign via the consecutive-system-error circuit breaker
- **THEN** the stream contains a `campaign.autopaused` event for that campaign with the
  consecutive `SYSTEM_ERROR` count that triggered it
