## ADDED Requirements

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

#### Scenario: conversation.ended attaches transcript and recording

- **WHEN** a `conversation.ended` event arrives whose call ref matches a recorded Voz IA gestión
- **THEN** that gestión is updated with the transcript and recording from the event

#### Scenario: Unmatched event is a no-op

- **WHEN** an event arrives whose call ref matches no gestión
- **THEN** the request is accepted and no gestión is changed
