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
- `DNC_CHECK`: config `{}` — suppress if the account's contact point is on the workspace
  Do Not Contact list (DNC list management is a future capability; this trigger type is
  reserved)

The `WRONG_NUMBER` and `OPT_OUT` trigger types SHALL NOT exist. The engine SHALL NOT suppress
outreach because of a delivery failure, because someone claimed during an interaction not to
be the account holder, or because a conversation was classified as a request to stop. None of
those is reliable enough to act on unattended: a delivery failure may be transient, and an
identity or opt-out claim is unverifiable and may come from someone who is not the account
holder. Every one of them is still recorded on the gestión and visible to operators.

Removing a contact point from outreach is an explicit, labelled decision recorded on the Do
Not Contact list and reached through `DNC_CHECK`. Until that list exists, `DNC_CHECK` matches
nothing and **no request to stop contact is enforced automatically** — operators must act on
the recorded `OPT_OUT` resultado themselves. This is a known, accepted gap; see issue #101.

#### Scenario: Account suppressed by max daily attempts

- **WHEN** the engine evaluates an account for dispatch
- **AND** the account has already been contacted `limit` times today under this campaign
- **THEN** the engine skips that account for the remainder of the day

#### Scenario: A wrong-party finding does not suppress

- **WHEN** an account has a gestión whose `resultado` is `WRONG_PARTY`
- **THEN** the engine SHALL continue to consider that account eligible for dispatch
- **AND** suppression SHALL require an explicit Do Not Contact entry

#### Scenario: A delivery failure does not suppress

- **WHEN** an account's attempts have recorded `entrega` `FAILED` with any `deliveryReason`
- **THEN** the engine SHALL continue to consider that account eligible for dispatch

### Requirement: AI contact triggers (intent-based suppression)

A Campaign SHALL support AI-derived suppression rules. These are applied when a
contact log entry is written with an AI-detected resultado.

Supported AI trigger types:

- `PAYMENT_PROMISE`: config `{ suppressDays: number }` — when an account contact log
  records a `PAYMENT_PROMISE` resultado, set the **campaign-local**
  `CampaignAccountState.suppressUntil` to the promise date (falling back to
  `contactedAt + suppressDays`). Default `suppressDays` is 7. This suppresses the
  account for this campaign only; other campaigns remain eligible.
- `INTENT_MET`: when a contact log records a `RESOLVED` or `PAID` resultado, set
  `intentStatus = INTENT_MET` on the account (global), suppressing all future
  dispatches across every campaign unless an operator explicitly clears it.
- `CALLBACK_REQUESTED`: config `{ suppressHours: number }` — when a contact log records
  a `CALLBACK_REQUESTED` resultado with a specific date/time extracted by the AI, set the
  **campaign-local** `CampaignAccountState.suppressUntil` to that date/time. Falls back
  to `now + suppressHours` if no specific time was captured.

#### Scenario: Payment promise suppresses this campaign only

- **WHEN** a gestión records `resultado` `PAYMENT_PROMISE` with a promised date
- **THEN** `CampaignAccountState.suppressUntil` is set for that campaign
- **AND** other campaigns remain eligible to contact the account

#### Scenario: Intent met suppresses globally

- **WHEN** a gestión records `resultado` `RESOLVED` or `PAID`
- **THEN** `intentStatus` is set to `INTENT_MET` and the account is suppressed across all
  campaigns

### Requirement: Triggers are campaign-scoped

Triggers SHALL be configured per campaign. Two campaigns may target the same portfolio with
different trigger configurations. The engine SHALL evaluate each campaign's triggers
independently.

#### Scenario: Different campaigns have independent trigger configs

- **WHEN** two active campaigns target the same portfolio
- **AND** campaign A has `MAX_ATTEMPTS_PER_DAY: 2` and campaign B has
  `MAX_ATTEMPTS_PER_DAY: 1`
- **THEN** the engine applies each campaign's limit independently
