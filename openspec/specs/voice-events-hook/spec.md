# voice-events-hook Specification

## Purpose

How voice call results reach QCobro: Fonoster's signed workspace webhooks, received at
`POST /api/voice/events`, finalize the gestión of each call QCobro placed, settle its usage,
and, for Voz IA, store the transcript from the call record and run the autopilot decision
over it.

## Requirements

### Requirement: Deliveries are verified before anything else

`POST /api/voice/events` SHALL accept only deliveries signed with `fonoster.webhookSecret`:
`X-Fonoster-Signature` holds one or more comma-separated hex HMAC-SHA256 values of
`<X-Fonoster-Timestamp>.<raw body>`, keyed with the secret as issued, and any one matching
SHALL be accepted (Fonoster sends two during a secret rotation). The signature SHALL be
checked over the raw body bytes, in constant time, before the body is parsed or the database
is read. A missing or wrong signature, or a timestamp more than 300 seconds from the server
clock, SHALL be answered `401` with no side effect. When `fonoster.webhookSecret` is not set,
the apiserver SHALL still start, log
`fonoster.webhookSecret is not set; voice call results will not be received`, and answer every
delivery `503` (Fonoster retries for 24 hours).

#### Scenario: A signed delivery is accepted

- **WHEN** a delivery signed with the configured secret is posted
- **THEN** it is answered `200`

#### Scenario: A bad signature has no effect

- **WHEN** a delivery has a wrong signature, no signature header, or a timestamp 301 seconds
  old
- **THEN** it is answered `401`
- **AND** no delivery status, settlement, insight or decision runs

#### Scenario: A rotation header is accepted

- **WHEN** the signature header holds two signatures and one is valid for the configured
  secret
- **THEN** the delivery is accepted

#### Scenario: No secret configured

- **WHEN** `fonoster.webhookSecret` is unset
- **THEN** the apiserver starts and the receiver answers `503`

### Requirement: Call events finalize the gestión and settle usage

The receiver SHALL correlate each event to the gestión QCobro created when it placed the call,
by `callRef` (the gestión's `providerRef`). `call.ended` for a VOICE_AI gestión SHALL finalize
it `DELIVERED` with the event's `durationSeconds` and, when billing is enabled, settle usage
with that duration (replacing the dispatch-time estimate with the increment-billed amount).
`call.failed` for a VOICE_AI or VOICE_PRERECORDED gestión SHALL finalize it `FAILED` with a
`deliveryReason` mapped from the event's `reason` (`busy`→`BUSY`, `no_answer`→`NO_ANSWER`,
`rejected`→`REJECTED`, `app_unreachable` and `node_error`→`PROVIDER_ERROR`, `removed` and any
other reason→`OUTCOME_UNKNOWN`) and settle usage to net zero; it is never left `DISPATCHED`.
`call.started`, `provider.deprecated` and unknown event types, events for an unknown `callRef`,
and `call.ended` for a pre-recorded gestión (whose outcome the voice server records
in-process) SHALL be answered `200` with no change. Delivery status and settlement SHALL run
before the response, so a failure answers `500` and Fonoster retries.

#### Scenario: Call completion settles usage

- **WHEN** billing is enabled and a `call.ended` event with `durationSeconds` 95 matches a
  gestión whose dispatch debited a 60-second estimate
- **THEN** the gestión is `DELIVERED` with 95 seconds
- **AND** a settlement adjustment is written so the net charge equals the increment-billed
  amount for 95 seconds

#### Scenario: A failed call is finalized with its reason

- **WHEN** a `call.failed` event with reason `busy` matches a dispatched gestión
- **THEN** the gestión is `FAILED` with `deliveryReason` `BUSY` and its usage nets to zero

#### Scenario: Unknown call ref

- **WHEN** an event arrives whose `callRef` matches no gestión
- **THEN** it is answered `200` and no gestión is changed

### Requirement: The Voz IA transcript comes from the call record

On `call_record.sealed` for a VOICE_AI gestión that is not yet decided, the receiver SHALL
fetch the call record's redacted copy (`CallRecords.getRecord(callRef)`) and store its
transcript on the gestión before answering: the record's `dialog` text entries in order, the
caller's turns as the customer and the agent's turns as the agent. A record fetch failure, or
one that takes longer than 8 seconds, SHALL be answered `500` and the event SHALL NOT count
as handled. A pre-recorded gestión's `call_record.sealed` SHALL be answered `200` without
fetching the record or changing the gestión.

#### Scenario: Turns are stored in order

- **WHEN** a sealed record has caller and agent text turns
- **THEN** the gestión's transcript holds them in dialog order, as customer and agent lines

#### Scenario: A record fetch failure is retried

- **WHEN** the record fetch fails
- **THEN** the delivery is answered `500` and no transcript is stored
- **AND** Fonoster's redelivery is handled normally

### Requirement: Voz IA autopilot decision on the call's transcript

Once the transcript is stored, the system SHALL run, after the response, the AI insight (when
`ai.generation` is `onIngestion`) and then a single autopilot decision over the full transcript
and account context, governed by the agent's `systemPrompt`, producing a structured `outcome`
and, when applicable, an `objective` (promised amount/date), recorded through the same
outcome-recording path Email and WhatsApp use, including `PaymentPromise` creation for a
payment commitment. Voz IA SHALL decide exactly once per call. The receiver SHALL answer within
10 seconds regardless of the insight or decision. A failure of either SHALL NOT fail the
delivery; the gestión then has a stored transcript and no decision, and the voice completion
sweep's next run SHALL run the insight and decision for it.

#### Scenario: A promise stated during the call is captured

- **WHEN** a call's transcript shows the customer stating an intent to pay a specific amount by
  a specific date
- **THEN** the decision carries a `PAYMENT_PROMISE` outcome and a matching objective
- **AND** a `PaymentPromise` is created linked to the gestión

#### Scenario: Empty transcript skips the decision

- **WHEN** a sealed record has no text turns (e.g. the call dropped immediately)
- **THEN** no decision is made and no outcome is recorded
- **AND** the delivery is still answered `200`

#### Scenario: A decision failure is recovered by the sweep

- **WHEN** the insight generator fails after the receiver answered `200`
- **THEN** the sweep's next run runs the insight and the decision exactly once

#### Scenario: Decision runs on the deterministic fallback when AI is disabled

- **WHEN** the `ai` config is absent, disabled, or set to the `mock` provider
- **THEN** the decision step still runs using a deterministic, non-LLM decider

### Requirement: Each side effect runs once

Every side effect SHALL check the gestión's persisted state before acting, so it runs once per
gestión regardless of event order (`call_record.sealed` can arrive before `call.ended`),
redelivery of the same event, later record versions (`version` 2 and up, with a new event id),
or a process restart: delivery status advances only from `DISPATCHED`, settlement only once
per call ref, the insight only while the gestión has none, and the decision only while the
gestión has no `path`.

#### Scenario: Any event order

- **WHEN** `call_record.sealed` arrives before `call.ended` for one Voz IA call, or after it
- **THEN** the gestión ends `DELIVERED`, the insight and decision ran once over the record's
  transcript, and usage settled once with `durationSeconds`

#### Scenario: Duplicate delivery settles once and decides once

- **WHEN** the same events are delivered twice for one call ref, including across a restart
- **THEN** exactly one settlement adjustment exists for that call
- **AND** exactly one decision ran, and at most one `PaymentPromise` exists for the gestión

#### Scenario: A later record version does not decide again

- **WHEN** a `call_record.sealed` with `version` 2 arrives for an already decided call
- **THEN** neither the insight nor the decision runs again

#### Scenario: Pre-recorded results are left alone

- **WHEN** `call.ended` or `call_record.sealed` arrives for a VOICE_PRERECORDED gestión
- **THEN** it is answered `200`, no Voz IA insight or decision runs, and the pre-recorded
  outcome is unchanged

### Requirement: Voz IA sync still registers the retired events-hook

Syncing a Voz IA agent SHALL keep registering the autopilot events-hook at
`<webhookBaseUrl>/api/voice/events` when `fonoster.webhookBaseUrl` is set, and sync without
one when it is not, until the sync moves to Fonoster's current agent format. Fonoster 0.6x
never calls that hook; call results arrive only through the workspace webhook.

#### Scenario: No events-hook when no base URL is configured

- **WHEN** `fonoster.webhookBaseUrl` is not set and a Voz IA agent is synced
- **THEN** the application is synced without an events-hook
