## ADDED Requirements

### Requirement: Hot-path suppression fields on PortfolioAccount

`PortfolioAccount` SHALL have three additional nullable fields to support engine
dispatch filtering without requiring a full contact-log join:

- `lastContactedAt DateTime?` — timestamp of the most recent outreach attempt
- `suppressUntil DateTime?` — if set and in the future, the engine SHALL skip this
  account; the API server sets this field when writing contact log entries with
  suppression-triggering outcomes
- `intentStatus IntentStatus?` — semantic status derived from AI outcomes; a Prisma
  enum with values `INTENT_MET`, `WRONG_NUMBER`, `OPT_OUT`; null means no notable
  intent has been captured

These fields are written by the API server when processing contact log entries; they
are NOT editable directly by operators through the portfolio account edit flow.

#### Scenario: Engine uses suppressUntil to skip accounts

- **WHEN** the engine evaluates an account for dispatch
- **AND** `suppressUntil` is set to a future timestamp
- **THEN** the engine SHALL skip the account
- **AND** no contact log entry is written for that skip

#### Scenario: Operator can clear suppressUntil via API

- **WHEN** an operator invokes the clear-suppression action for an account
- **THEN** `suppressUntil` is set to null
- **AND** `intentStatus` is optionally cleared if the operator confirms
- **AND** the account becomes eligible for dispatch on the next engine cycle

#### Scenario: CSV sync does not reset suppression fields

- **WHEN** a CSV sync updates account data for an existing account
- **THEN** `lastContactedAt`, `suppressUntil`, and `intentStatus` are NOT overwritten
- **AND** all other account data fields (outstandingBalance, phone, etc.) are updated
  as defined by the sync mode
