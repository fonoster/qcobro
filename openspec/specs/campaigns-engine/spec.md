# campaigns-engine Specification

## Purpose

TBD - created by archiving change email-channel. Update Purpose after archive.

## Requirements

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

### Requirement: Credit gate in the tick

When billing is enabled, the engine tick SHALL consult a per-workspace credit bucket (per
billing-enforcement) alongside the existing per-channel token buckets. The account decision
set SHALL include `credits_exhausted` and the campaign skip-reason set SHALL include
`credits_exhausted` and `payment_failed` (the payer-dunning suspension, per
billing-accounts); these SHALL appear in the tick report and flight-recorder events exactly
as existing cap decisions do, so downstream consumers (console, evaluation) observe why
dispatching stopped.

#### Scenario: Credit exhaustion recorded like other caps

- **WHEN** a workspace's credit bucket empties during a tick
- **THEN** affected accounts appear in the tick report with decision `credits_exhausted` and
  corresponding `account.decided` events are recorded

#### Scenario: Channel budgets and credits gate independently

- **WHEN** a workspace has credits remaining but a channel's token bucket is exhausted
- **THEN** the channel budget decision applies (not `credits_exhausted`), and vice versa
