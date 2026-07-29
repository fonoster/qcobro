## ADDED Requirements

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
