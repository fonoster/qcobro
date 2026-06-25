## MODIFIED Requirements

### Requirement: Static contact triggers

A Campaign SHALL support static trigger rules that suppress outreach to an account
before any AI interaction occurs. Static triggers are evaluated by the engine before
each dispatch attempt (during the reserve transaction's eligibility re-check).

Per-account attempt limits are **not** triggers: the daily and lifetime caps are the
canonical `Campaign.maxAttemptsPerDay` and `Campaign.maxAttemptsPerAccount` fields,
enforced by the engine's eligibility funnel. The former `MAX_ATTEMPTS_PER_DAY` trigger
type is removed as redundant. **Migration:** set the daily cap via the
`Campaign.maxAttemptsPerDay` field; any existing `MAX_ATTEMPTS_PER_DAY` trigger rows are
ignored by the engine and may be deleted.

Supported static trigger types:

- `DNC_CHECK`: config `{}` — suppress if the account's phone is on the workspace DNC
  list (DNC list management is a future capability; this trigger type is reserved)
- `WRONG_NUMBER`: suppress if the account has a `WRONG_NUMBER` intent status
- `OPT_OUT`: suppress if the account has an `OPT_OUT` intent status

#### Scenario: Account suppressed by wrong-number flag

- **WHEN** an account's `intentStatus` is `WRONG_NUMBER`
- **THEN** the engine SHALL never dispatch to that account under any campaign until an
  operator explicitly clears the flag

#### Scenario: Per-account daily cap is enforced via the campaign field

- **WHEN** an account has reached `Campaign.maxAttemptsPerDay` for the local day
- **THEN** the engine skips that account for the remainder of the day
- **AND** this enforcement uses the campaign field, not a trigger

### Requirement: Triggers are campaign-scoped

Triggers SHALL be configured per campaign. Two campaigns may target the same portfolio with
different trigger configurations. The engine SHALL evaluate each campaign's triggers
independently.

#### Scenario: Different campaigns have independent trigger configs

- **WHEN** two active campaigns target the same portfolio
- **AND** campaign A has a `PAYMENT_PROMISE` trigger with `suppressDays: 7` and campaign B
  has `suppressDays: 3`
- **THEN** the engine applies each campaign's suppression independently
