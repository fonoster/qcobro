## ADDED Requirements

### Requirement: EMAIL channel support and pacing

The engine SHALL treat EMAIL as a dispatchable channel. EMAIL readiness SHALL pass when the
`resend` configuration is present (API key + inbound reply domain); when it is absent, the
campaign SHALL be skipped as `channel_not_configured` (no longer `channel_not_supported`).
EMAIL dispatches SHALL be paced by their own per-channel token bucket sized from
`resend.maxEmailsPerMinute`, independent of the voice and SMS buckets. The per-attempt reply
cap SHALL be enforced per `(campaign, account)` collection attempt.

#### Scenario: EMAIL campaign dispatches when Resend is configured

- **WHEN** an EMAIL campaign is in-window and the `resend` config is present
- **THEN** the engine dispatches up to the email per-minute budget and records one gestión
  per attempt

#### Scenario: EMAIL campaign is skipped when Resend is absent

- **WHEN** an EMAIL campaign is in-window but the `resend` config is absent
- **THEN** the campaign is skipped with reason `channel_not_configured` and nothing is sent
