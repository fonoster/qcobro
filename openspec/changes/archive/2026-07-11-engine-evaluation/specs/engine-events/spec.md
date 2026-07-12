## ADDED Requirements

### Requirement: Engine ticks persist a correlated event stream

Each engine tick SHALL persist an append-only stream of engine events covering the full
tick lifecycle: `tick.started` (with per-channel budgets granted), one `campaign.evaluated`
per active campaign (window/skip/completed outcome, candidate count, and the campaign's
display name so scorecards never join back for it), one
`account.decided` per considered account (the funnel decision, with `providerRef` when
dispatched), and `tick.completed` (duration and per-channel usage). Every event SHALL carry
the correlation fields that apply to it — tick id, sequence number within the tick,
workspace ref, campaign id, portfolio account id, provider ref, channel — and a timestamp
from the engine's injected clock. All campaign-, account-, dispatch-, and provider-scoped
events SHALL carry the workspace ref; only tick lifecycle events are deployment-level.
Account decisions SHALL never be sampled.

#### Scenario: A tick with an active campaign leaves a complete trace

- **WHEN** the engine runs one tick over an active in-window campaign with candidates
- **THEN** the persisted stream for that tick contains `tick.started`, one
  `campaign.evaluated` for the campaign, one `account.decided` per candidate, and
  `tick.completed`, all sharing the same tick id and ordered by sequence number

#### Scenario: Dispatched decision carries the provider ref

- **WHEN** an account is dispatched during a tick
- **THEN** its `account.decided` event records the decision `dispatched` and the provider
  ref returned by the channel client

### Requirement: Dispatch lifecycle is recorded with latency and error class

For every dispatch the engine attempts, the stream SHALL contain an `attempt.reserved`
event followed by `dispatch.requested`, and then either `dispatch.succeeded` (with the
provider ref and latency) or `dispatch.failed` (with latency, an error class, and the error
message). Recipient identifiers in dispatch events SHALL be masked; rendered message
bodies, scripts, and transcripts SHALL NOT be stored in the stream.

#### Scenario: Failed dispatch is recorded, not just logged

- **WHEN** a channel client throws during dispatch
- **THEN** the stream contains a `dispatch.failed` event for that account with the error
  class and message, and the corresponding `account.decided` event records
  `dispatch_failed`

#### Scenario: No message content in the stream

- **WHEN** any dispatch event is persisted
- **THEN** it contains no rendered message body, script, or transcript, and the recipient
  identifier is masked

### Requirement: Campaign evaluation events snapshot the config the run used

Each `campaign.evaluated` event SHALL embed a snapshot of the campaign parameters the
engine used that tick — schedule fields, attempt caps, workspace timezone, and channel — so
an event stream can be evaluated without reading live campaign rows.

#### Scenario: Evaluation survives a later campaign edit

- **WHEN** a campaign's schedule is edited after a tick has run
- **THEN** the `campaign.evaluated` events persisted before the edit still carry the
  schedule values that were in force during that tick

### Requirement: Inbound provider events are recorded on receipt

The apiserver SHALL record every inbound provider signal it handles — voice conversation
events, SMS delivery callbacks, WhatsApp statuses, inbound email webhooks — as a
`provider.event` carrying the source, the provider ref, the provider-side timestamp when
the payload includes one, the receipt time, and whether it matched a known gestión. An
unmatched event SHALL still be recorded.

#### Scenario: Voice conversation event is recorded and correlated

- **WHEN** a `conversation.ended` event arrives at the voice events endpoint for a call the
  engine placed
- **THEN** a `provider.event` is persisted with source `voice-events`, the call's provider
  ref, provider and receipt timestamps, and matched = true

#### Scenario: Unmatched provider event is still recorded

- **WHEN** a provider callback arrives whose ref matches no gestión
- **THEN** a `provider.event` is persisted with matched = false

### Requirement: Event persistence is best-effort and never affects dispatch

A failure to persist engine events SHALL NOT fail the tick, prevent a dispatch, or alter
any engine decision; the failure SHALL be logged and the events dropped.

#### Scenario: Sink failure does not block outreach

- **WHEN** the event sink throws while persisting a tick's events
- **THEN** the tick completes, dispatches and gestiones are unaffected, and the sink error
  is logged

### Requirement: Engine events are retrievable over the API

The apiserver SHALL expose a read-only endpoint (`GET /api/engine/events`) that returns
persisted engine events for a requested time range together with the deployment's engine
parameters (rate caps, tick interval). The endpoint SHALL authenticate callers through the
existing API-key infrastructure — a workspace API key pair (accessKeyId + accessKeySecret)
presented as Basic credentials and validated against Fonoster Identity, the same way the
SDK's key exchange works — and SHALL scope the response to the key's workspace: the
workspace's own events plus the deployment-level tick lifecycle events. Events belonging
to other workspaces SHALL NOT be returned.

#### Scenario: Authorized range fetch is workspace-scoped

- **WHEN** a caller presents a valid API key pair and requests events for a from/to range
- **THEN** the response contains exactly that workspace's events in the range, the
  deployment-level tick lifecycle events in the range, and the deployment's engine
  parameters

#### Scenario: Another workspace's events are not visible

- **WHEN** events exist for two workspaces in the same range and a caller authenticates
  with workspace A's API key
- **THEN** no campaign, account, dispatch, or provider event of workspace B appears in the
  response

#### Scenario: Invalid key is rejected

- **WHEN** a caller presents no credentials or an invalid API key pair
- **THEN** the request is rejected and no events are returned

### Requirement: Engine events are pruned by a configured retention window

The system SHALL delete engine events older than `engine.eventsRetentionDays` (from
`qcobro.json`; `0` disables pruning) without requiring a separate scheduler process.

#### Scenario: Expired events are removed

- **WHEN** events exist older than the configured retention window and the engine is
  running
- **THEN** those events are eventually deleted while newer events are kept
