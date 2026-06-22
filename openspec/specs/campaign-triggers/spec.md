# campaign-triggers Specification

## Purpose

TBD — created by syncing change campaigns-core. Update Purpose after archive.

## Requirements

### Requirement: Static contact triggers

A Campaign SHALL support static trigger rules that suppress outreach to an account
before any AI interaction occurs. Static triggers are evaluated by the engine before
each dispatch attempt.

Supported static trigger types:

- `MAX_ATTEMPTS_PER_DAY`: config `{ limit: number }` — suppress if the account has
  already been contacted `limit` times today
- `DNC_CHECK`: config `{}` — suppress if the account's phone is on the workspace DNC
  list (DNC list management is a future capability; this trigger type is reserved)
- `WRONG_NUMBER`: suppress if the account has a `WRONG_NUMBER` intent status
- `OPT_OUT`: suppress if the account has an `OPT_OUT` intent status

#### Scenario: Account suppressed by max daily attempts

- **WHEN** the engine evaluates an account for dispatch
- **AND** the account has already been contacted `limit` times today under this campaign
- **THEN** the engine skips that account for the remainder of the day

#### Scenario: Account suppressed by wrong-number flag

- **WHEN** an account's `intentStatus` is `WRONG_NUMBER`
- **THEN** the engine SHALL never dispatch to that account under any campaign until an
  operator explicitly clears the flag

### Requirement: AI contact triggers (intent-based suppression)

A Campaign SHALL support AI-derived suppression rules. These are applied when a
contact log entry is written with an AI-detected outcome.

Supported AI trigger types:

- `PAYMENT_PROMISE`: config `{ suppressDays: number }` — when an account contact log
  records a `PAYMENT_PROMISE` outcome, set the **campaign-local**
  `CampaignAccountState.suppressUntil` to the promise date (falling back to
  `contactedAt + suppressDays`). Default `suppressDays` is 7. This suppresses the
  account for this campaign only; other campaigns remain eligible.
- `INTENT_MET`: when a contact log records a `RESOLVED` or `PAID` outcome, set
  `intentStatus = INTENT_MET` on the account (global), suppressing all future
  dispatches across every campaign unless an operator explicitly clears it.
- `CALLBACK_REQUESTED`: config `{ suppressHours: number }` — when a contact log records
  a `CALLBACK_REQUESTED` outcome with a specific date/time extracted by the AI, set the
  **campaign-local** `CampaignAccountState.suppressUntil` to that date/time. Falls back
  to `now + suppressHours` if no specific time was captured.

#### Scenario: Payment promise suppresses account until promise date

- **WHEN** a contact log entry is written for account A with outcome `PAYMENT_PROMISE`
- **AND** the campaign has a `PAYMENT_PROMISE` trigger configured
- **THEN** the API server updates the campaign-local `CampaignAccountState.suppressUntil`
  to the promise date (falling back to `contactedAt + suppressDays`)
- **AND** the engine will not dispatch to account A under this campaign until after
  `suppressUntil`
- **AND** account A remains eligible for dispatch under other campaigns

#### Scenario: Resolved intent permanently suppresses account

- **WHEN** a contact log entry is written with outcome `RESOLVED` or `PAID`
- **THEN** `PortfolioAccount.intentStatus` is set to `INTENT_MET`
- **AND** the account is excluded from all future campaign dispatches until an operator
  clears `intentStatus`

#### Scenario: Operator can override AI suppression

- **WHEN** an operator explicitly clears `suppressUntil` or `intentStatus` on an account
- **THEN** the account becomes eligible for dispatch again on the next engine cycle

### Requirement: Triggers are campaign-scoped

Triggers SHALL be configured per campaign. Two campaigns may target the same portfolio with
different trigger configurations. The engine SHALL evaluate each campaign's triggers
independently.

#### Scenario: Different campaigns have independent trigger configs

- **WHEN** two active campaigns target the same portfolio
- **AND** campaign A has `MAX_ATTEMPTS_PER_DAY: 2` and campaign B has
  `MAX_ATTEMPTS_PER_DAY: 1`
- **THEN** the engine applies each campaign's limit independently
