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
