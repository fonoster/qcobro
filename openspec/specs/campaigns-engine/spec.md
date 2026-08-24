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

### Requirement: Attempt budget excludes system-error dispatch failures

The engine SHALL only increment `CampaignAccountState.attemptCount`, `attemptsToday`, and
`PortfolioAccount.totalAttempts` for an outreach attempt whose dispatch outcome is either a
success or a `DispatchError` with `kind: DELIVERY_REJECTED`. A dispatch that fails with
`kind: SYSTEM_ERROR` SHALL NOT increment any attempt counter, since the provider never actually
attempted to reach the recipient.

#### Scenario: A delivered attempt counts against the budget

- **WHEN** the engine dispatches to an account and the send succeeds
- **THEN** the account's `attemptCount` and `attemptsToday` are incremented

#### Scenario: A delivery-rejected attempt counts against the budget

- **WHEN** the engine dispatches to an account and the provider rejects delivery
  (`DispatchError` with `kind: DELIVERY_REJECTED`)
- **THEN** the account's `attemptCount` and `attemptsToday` are still incremented

#### Scenario: A system-error attempt does not count against the budget

- **WHEN** the engine dispatches to an account and the provider call fails with
  `kind: SYSTEM_ERROR`
- **THEN** the account's `attemptCount` and `attemptsToday` are left unchanged
- **AND** the account remains eligible for a future attempt in this campaign regardless of its
  attempt caps

### Requirement: Consecutive system-error circuit breaker auto-pauses a campaign

The engine SHALL track, per campaign, the number of consecutive `SYSTEM_ERROR` dispatch
failures across attempts. When that count reaches the configured
`engine.consecutiveSystemErrorPauseThreshold` (from `qcobro.json`), the engine SHALL transition
the campaign to `PAUSED` with `pauseReason: AUTO_ERROR_THRESHOLD`, stopping further dispatch for
that campaign until an operator reactivates it. The counter SHALL reset to zero whenever the
campaign has a dispatch that is either a success or a `DELIVERY_REJECTED` failure, since either
outcome shows the channel is currently reachable.

#### Scenario: Sustained system errors pause the campaign

- **WHEN** a campaign's dispatches fail with `kind: SYSTEM_ERROR` for
  `engine.consecutiveSystemErrorPauseThreshold` consecutive attempts
- **THEN** the campaign is transitioned to `PAUSED` with `pauseReason: AUTO_ERROR_THRESHOLD`
- **AND** no further dispatch is attempted for that campaign until an operator reactivates it

#### Scenario: A successful or delivery-rejected dispatch resets the counter

- **WHEN** a campaign has some consecutive `SYSTEM_ERROR` failures and then a dispatch succeeds
  or fails with `kind: DELIVERY_REJECTED`
- **THEN** the consecutive system-error count resets to zero
- **AND** the campaign is not paused

#### Scenario: Manual reactivation is required after an auto-pause

- **WHEN** a campaign has been auto-paused by the circuit breaker
- **THEN** it stays `PAUSED` until an operator explicitly transitions it back to `ACTIVE`
- **AND** nothing in the engine automatically resumes it

### Requirement: A hung tick does not block every future tick

The runner SHALL bound how long a single tick (advisory-lock acquisition through dispatch and
release) may run before releasing its in-process single-flight guard, so a tick that hangs —
a stalled database connection, an unresponsive provider call — cannot silently block every
scheduled tick after it. The bound SHALL be configurable via `engine.maxTickMs` (from
`qcobro.json`). The hung operation itself is not cancelled (not possible for an in-flight
promise); it may still settle later, harmlessly — the Postgres advisory lock, not the
in-process guard, is what actually prevents two ticks from dispatching at once, so a released
guard that lets a new tick attempt while the old one is still technically pending is safe: the
new attempt observes the lock is still held and no-ops cleanly. A watchdog trip SHALL be logged
distinctly from an ordinary tick failure, so it is diagnosable rather than silent.

#### Scenario: A tick that never resolves does not block subsequent ticks

- **WHEN** a tick's underlying work hangs (never resolves or rejects) past `engine.maxTickMs`
- **THEN** the runner's in-process single-flight guard releases
- **AND** the next scheduled tick is attempted rather than skipped forever

#### Scenario: A watchdog trip is logged distinctly

- **WHEN** the watchdog releases a hung tick
- **THEN** a distinct log entry records that the watchdog fired, separately from the existing
  "tick failed" error path used for a tick that actually threw
