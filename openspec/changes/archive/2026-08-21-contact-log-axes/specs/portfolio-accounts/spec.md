## MODIFIED Requirements

### Requirement: Hot-path suppression fields on PortfolioAccount

`PortfolioAccount` SHALL carry denormalized hot-path fields so the engine can perform
dispatch filtering without requiring a full contact-log join:

- `lastContactedAt DateTime?` — timestamp of the most recent outreach attempt
- `suppressUntil DateTime?` — if set and in the future, the engine SHALL skip this
  account; the API server sets this field when writing contact log entries with
  suppression-triggering resultados
- `intentStatus IntentStatus?` — semantic status derived from AI resultados; a Prisma
  enum whose only value is `INTENT_MET`; null means no notable intent has been captured

`IntentStatus` SHALL carry exactly one value, `INTENT_MET`, meaning the debt is settled and
there is nothing left to collect. It is the only condition under which the engine suppresses
an account on its own, because it is a statement about the debt itself rather than an
inference about a contact point.

The `WRONG_NUMBER` and `OPT_OUT` intent statuses SHALL NOT exist. Nothing populates them: a
delivery failure records `entrega` `FAILED`, an identity claim records `resultado`
`WRONG_PARTY`, and a request to stop contact records `resultado` `OPT_OUT` — all on the
gestión, none setting an account-level flag. Removing a contact point from outreach is an
explicit, labelled decision on the workspace Do Not Contact list, reached by the engine
through the `DNC_CHECK` trigger, not something inferred from an interaction.

These fields are written by the API server when processing contact log entries; they
are NOT editable directly by operators through the portfolio account edit flow.

#### Scenario: Engine uses suppressUntil to skip accounts

- **WHEN** the engine evaluates an account for dispatch
- **AND** `suppressUntil` is set to a future timestamp
- **THEN** the engine SHALL skip the account

#### Scenario: A delivery failure leaves intentStatus untouched

- **WHEN** a gestión is written for an account with `entrega` `FAILED`
- **THEN** the account's `intentStatus` is unchanged and it remains eligible for dispatch

#### Scenario: A wrong-party finding leaves intentStatus untouched

- **WHEN** a gestión is written for an account with `resultado` `WRONG_PARTY`
- **THEN** the account's `intentStatus` is unchanged and it remains eligible for dispatch

#### Scenario: An opt-out leaves intentStatus untouched

- **WHEN** a gestión is written for an account with `resultado` `OPT_OUT`
- **THEN** the account's `intentStatus` is unchanged and it remains eligible for dispatch
- **AND** honouring the request requires a Do Not Contact entry for the contact point
