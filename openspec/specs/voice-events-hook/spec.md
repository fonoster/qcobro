# voice-events-hook Specification

## Purpose

TBD - created by archiving change voice-integration. Update Purpose after archive.

## Requirements

### Requirement: Voz IA sync registers the autopilot events-hook

Syncing a Voz IA agent to Fonoster SHALL register the autopilot events-hook at
`<webhookBaseUrl>/api/voice/events`, subscribed to all conversation events, whenever
`fonoster.webhookBaseUrl` is configured, so the autopilot posts `conversation.started` and
`conversation.ended` back to QCobro. When no base URL is configured, the agent SHALL sync
without an events-hook.

#### Scenario: Events-hook registered when a base URL is configured

- **WHEN** `fonoster.webhookBaseUrl` is set and a Voz IA agent is synced (created or updated)
- **THEN** the Fonoster application is configured with an events-hook whose URL is
  `<webhookBaseUrl>/api/voice/events` subscribed to all conversation events

#### Scenario: No events-hook when no base URL is configured

- **WHEN** `fonoster.webhookBaseUrl` is not set and a Voz IA agent is synced
- **THEN** the application is synced without an events-hook (no callback is registered)

### Requirement: Conversation events return as gestión updates

The `POST /api/voice/events` endpoint SHALL accept the autopilot conversation events and
correlate each to the gestión created when QCobro placed the call (by call ref), updating it:
`conversation.started` records partial progress, `conversation.ended` attaches the transcript
and recording. An event that matches no gestión SHALL be accepted without changes.

When billing is enabled, `conversation.ended` SHALL additionally report the call's answered
duration in seconds (time from answer to hang-up; zero when never answered — ring time
excluded, voicemail pickup counting as answered) and trigger usage settlement for the
matched gestión's workspace: a settlement adjustment replacing the dispatch-time estimate
with the increment-billed amount for that answered duration (per usage-ledger). Settlement
SHALL be idempotent per call ref.

#### Scenario: conversation.ended attaches transcript and recording

- **WHEN** a `conversation.ended` event arrives whose call ref matches a recorded Voz IA gestión
- **THEN** that gestión is updated with the transcript and recording from the event

#### Scenario: Unmatched event is a no-op

- **WHEN** an event arrives whose call ref matches no gestión
- **THEN** the request is accepted and no gestión is changed

#### Scenario: Call completion settles usage

- **WHEN** billing is enabled and a `conversation.ended` event with 95 answered seconds
  matches a gestión whose dispatch debited a 60-second estimate
- **THEN** a settlement adjustment is written so the net charge equals the increment-billed
  amount for 95 seconds

#### Scenario: Duplicate completion event settles once

- **WHEN** the same `conversation.ended` event is delivered twice for one call ref
- **THEN** exactly one settlement adjustment exists for that call

### Requirement: Voz IA autopilot decision on call end

The system SHALL run the Voz IA agent as an autopilot when a `conversation.ended` event
matches a gestión and carries a non-empty transcript: a single decision step over the full
final transcript and account context, governed by the agent's `systemPrompt`, producing a
structured `outcome` and, when applicable, an `objective` (promised amount/date) — reusing
the same decision contract Email and WhatsApp use for their per-reply decisions. Unlike
Email/WhatsApp, which decide on every inbound reply, Voz IA SHALL decide exactly once per
call, since QCobro does not observe individual turns during the live call. When the decision
carries an outcome, it SHALL be recorded through the same outcome-recording path Email/
WhatsApp use, including `PaymentPromise` creation when the outcome implies a payment
commitment. The decision step SHALL run after the event's response has been sent and SHALL
NOT cause the webhook to fail if the decision itself fails (LLM error, malformed model
output, etc.) — event ingestion, transcript persistence, and billing settlement SHALL be
unaffected by a decision failure.

#### Scenario: A promise stated during the call is captured

- **WHEN** a `conversation.ended` event's transcript shows the customer stating an intent to
  pay a specific amount by a specific date
- **THEN** the decision carries a `PAYMENT_PROMISE` outcome and a matching objective
- **AND** a `PaymentPromise` is created linked to the gestión

#### Scenario: A non-payment outcome is recorded without a PaymentPromise

- **WHEN** a `conversation.ended` event's transcript implies an outcome that is not a payment
  commitment (e.g. wrong number, dispute, refusal)
- **THEN** that outcome is recorded on the gestión
- **AND** no `PaymentPromise` is created

#### Scenario: Empty transcript skips the decision

- **WHEN** a `conversation.ended` event matches a gestión whose transcript is empty (e.g. the
  call dropped immediately)
- **THEN** no decision is made and no outcome is recorded
- **AND** the event is still accepted and any transcript/recording/duration fields present are
  still persisted as usual

#### Scenario: A decision failure does not fail the webhook

- **WHEN** the decision step raises an error (e.g. the LLM call fails or its output cannot be
  parsed)
- **THEN** the `conversation.ended` event is still accepted and its transcript/recording/
  duration are still persisted
- **AND** billing settlement for the call still proceeds
- **AND** no outcome or `PaymentPromise` is recorded for that delivery

#### Scenario: Re-delivered completion event does not duplicate a promise

- **WHEN** the same `conversation.ended` event is delivered twice for one call ref and both
  deliveries produce a `PAYMENT_PROMISE` decision
- **THEN** exactly one `PaymentPromise` exists for that gestión

#### Scenario: Decision runs on the deterministic fallback when AI is disabled

- **WHEN** the `ai` config is absent, disabled, or set to the `mock` provider
- **THEN** the decision step still runs using a deterministic, non-LLM decider, so Voz IA
  payment-promise capture works in dev/test and demos without a live model key
