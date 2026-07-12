# campaigns-engine Specification (delta)

## ADDED Requirements

### Requirement: Credit gate in the tick

When billing is enabled, the engine tick SHALL consult a per-workspace credit bucket (per
billing-enforcement) alongside the existing per-channel token buckets. The account decision
set SHALL include `credits_exhausted` and the campaign skip-reason set SHALL include
`credits_exhausted`; both SHALL appear in the tick report and flight-recorder events exactly
as existing cap decisions do, so downstream consumers (console, evaluation) observe why
dispatching stopped.

#### Scenario: Credit exhaustion recorded like other caps

- **WHEN** a workspace's credit bucket empties during a tick
- **THEN** affected accounts appear in the tick report with decision `credits_exhausted` and
  corresponding `account.decided` events are recorded

#### Scenario: Channel budgets and credits gate independently

- **WHEN** a workspace has credits remaining but a channel's token bucket is exhausted
- **THEN** the channel budget decision applies (not `credits_exhausted`), and vice versa
