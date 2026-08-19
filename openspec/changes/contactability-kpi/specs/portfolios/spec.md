## ADDED Requirements

### Requirement: Contactability is derived from gestión outcomes

The apiserver SHALL expose a workspace-scoped contactability statistic as a pair of counts:
the accounts under management, and how many of them have actually been reached.

- **Denominator** — every non-archived `PortfolioAccount` belonging to a portfolio in the
  active workspace.
- **Numerator** — those accounts having **at least one** `AccountContactLog` whose `outcome`
  proves the channel reached the destination.

An outcome proves the channel worked when it is **not** one of the channel-failure values:
`DISPATCHED` (no result yet), `NOT_DELIVERED`, `NO_ANSWER`, `WRONG_NUMBER`. The rule SHALL be
expressed as this exclusion and SHALL NOT be expressed as equality against `DELIVERED`:
a `PAYMENT_PROMISE`, `CALLBACK_REQUESTED`, `DISPUTE_RAISED`, `REFUSED`, `OPT_OUT` or `PAID`
can only occur once the channel already worked, and an outcome added to the enum later will
carry the same implication. Stating it as an exclusion fails safe — a new outcome counts as
contact unless it is deliberately classified as a failure.

Contactability SHALL NOT be derived from `PortfolioAccount.lastContactedAt`. That field
records the most recent outreach **attempt** and is written at attempt-reservation time,
before any channel result exists; reading it as contact counts every dispatch as a success.

"Contacted" here means only that the channel worked — the message reached the handset, the
call connected. It SHALL NOT require that the debtor read, answered, engaged with, or replied
to the outreach.

#### Scenario: An account whose attempts all failed is not contacted

- **GIVEN** an account whose gestións are all `NOT_DELIVERED`, `NO_ANSWER`, or `WRONG_NUMBER`
- **WHEN** contactability is read
- **THEN** the account counts toward the denominator and not toward the numerator

#### Scenario: A downstream engagement outcome proves contact

- **GIVEN** an account whose only gestión has outcome `PAYMENT_PROMISE`
- **WHEN** contactability is read
- **THEN** the account counts as contacted, even though no gestión carries `DELIVERED`

#### Scenario: An in-flight dispatch does not count as contact

- **GIVEN** an account whose only gestión is still at the `DISPATCHED` placeholder
- **WHEN** contactability is read
- **THEN** the account does not count as contacted
- **AND** once that gestión is finalized to `DELIVERED`, the account does count

#### Scenario: One success is enough

- **GIVEN** an account with several failed gestións and one `DELIVERED`
- **WHEN** contactability is read
- **THEN** the account counts as contacted exactly once

#### Scenario: A never-attempted account is counted in the denominator only

- **GIVEN** an active account with no gestións at all
- **WHEN** contactability is read
- **THEN** it is included in the account total and excluded from the contacted total

#### Scenario: Archived accounts are excluded

- **WHEN** contactability is read
- **THEN** archived accounts and accounts in archived portfolios are excluded from both counts
