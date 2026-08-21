# portfolio-accounts Specification

## Purpose

TBD - created by archiving change portfolio-management. Update Purpose after archive.

## Requirements

### Requirement: Portfolio account listing

The apiserver SHALL expose a paginated listing of accounts within a portfolio. The listing SHALL be scoped to the caller's workspace (the portfolio itself enforces this). Results SHALL be ordered by full name ascending.

#### Scenario: Operator browses accounts in a portfolio

- **WHEN** an authenticated operator requests the account list for a portfolio with optional `limit` and `offset` parameters
- **THEN** up to `limit` accounts are returned (default 50) along with the total count
- **AND** accounts are ordered alphabetically by full name

#### Scenario: Pagination returns correct slice

- **WHEN** a portfolio has 120 accounts and the operator requests offset 50 with limit 50
- **THEN** accounts 51–100 are returned
- **AND** the total count reports 120

### Requirement: CSV import with configurable sync mode

The apiserver SHALL accept a batch of account rows and a sync mode, then upsert the accounts into the portfolio within a single transaction. The three supported modes are:

- **APPEND_ONLY**: Insert rows whose `loan_id` does not yet exist in the portfolio. Existing accounts are untouched.
- **UPDATE_EXISTING**: Insert new rows and update all fields of accounts whose `loan_id` already exists. No deletions.
- **REPLACE**: Insert new rows, update existing rows, and delete any account whose `loan_id` is present in the portfolio but absent from the incoming batch.

After mutating account rows the transaction SHALL recompute and persist `accountCount` and `totalOutstandingBalance` on the parent portfolio, and SHALL stamp the portfolio's `lastSyncedAt` with the completion time.

#### Scenario: APPEND_ONLY adds new accounts without touching existing ones

- **WHEN** an operator syncs with mode APPEND_ONLY and the batch contains rows with both new and existing loan_ids
- **THEN** rows with new loan_ids are inserted
- **AND** rows with existing loan_ids are skipped (no field updates)
- **AND** the portfolio's account count increases by the number of new rows

#### Scenario: UPDATE_EXISTING updates existing accounts and inserts new ones

- **WHEN** an operator syncs with mode UPDATE_EXISTING and the batch contains rows with both new and existing loan_ids
- **THEN** rows with new loan_ids are inserted
- **AND** rows with existing loan_ids have all their fields updated to the incoming values
- **AND** accounts whose loan_id is absent from the batch remain unchanged

#### Scenario: REPLACE performs a full refresh with soft-archiving

- **WHEN** an operator syncs with mode REPLACE and the batch contains a set of loan_ids that partially overlaps the current portfolio
- **THEN** new loan_ids are inserted
- **AND** matching loan_ids are updated
- **AND** accounts whose loan_id is in the portfolio but absent from the batch are soft-archived (their `archivedAt` is set to the current timestamp)
- **AND** the active account count equals exactly the number of rows in the batch
- **AND** archived accounts are retained in the database and do not appear in account listings or aggregate stats

#### Scenario: A previously archived account is re-imported

- **WHEN** a loan_id that was previously soft-archived appears in a new sync batch
- **THEN** the account is un-archived (`archivedAt` is cleared) and its fields are updated to the incoming values
- **AND** the account is treated as active again and included in listings and stats

#### Scenario: Sync result reports mutation counts

- **WHEN** a sync completes successfully
- **THEN** the response includes the count of created, updated, and archived accounts
- **AND** the total active account count in the portfolio after the operation
- **AND** the portfolio's `lastSyncedAt` is updated to the completion time

#### Scenario: Sync runs atomically

- **WHEN** an error occurs mid-sync (e.g., a constraint violation on one row)
- **THEN** the entire operation is rolled back
- **AND** the portfolio's accounts, aggregate stats, and `lastSyncedAt` remain unchanged from before the sync

### Requirement: CSV column validation

The webapp CSV parser SHALL validate that required columns are present and that required fields in each row are non-empty before submitting rows to the API. Invalid files SHALL surface structured errors to the operator before any API call is made.

#### Scenario: Missing required columns are detected before upload

- **WHEN** an operator uploads a CSV that is missing any of `loan_id`, `full_name`, or `outstanding_balance` columns
- **THEN** parsing fails immediately with a message identifying the missing columns
- **AND** no rows are submitted to the API

#### Scenario: Rows with empty required fields are flagged

- **WHEN** a CSV row has an empty `loan_id`, `full_name`, or `outstanding_balance`
- **THEN** that row is excluded from the valid set
- **AND** a per-row error message is reported to the operator (e.g., "Row 4: loan_id is empty")
- **AND** only valid rows are submitted to the API

#### Scenario: loan_id is unique per portfolio

- **WHEN** the database already contains a `PortfolioAccount` with the same `portfolioId` and `loan_id`
- **THEN** the behavior is determined by the sync mode (skip, update, or replace) — never a duplicate-key error from the API

### Requirement: Account data fields

Each `PortfolioAccount` record SHALL carry the following fields derived from the CSV. Optional fields are omitted when the CSV cell is empty.

| CSV column            | Field                | Required | Type                                                                   |
| --------------------- | -------------------- | -------- | ---------------------------------------------------------------------- |
| `loan_id`             | `externalId`         | yes      | string                                                                 |
| `full_name`           | `fullName`           | yes      | string                                                                 |
| `phone_number`        | `phone`              |          | string, normalized to E.164 at write time (see below)                  |
| `preferred_language`  | `preferredLanguage`  |          | string (BCP-47, e.g. `es-DO`)                                          |
| `best_time_to_call`   | `bestTimeToCall`     |          | string                                                                 |
| `customer_segment`    | `customerSegment`    |          | string                                                                 |
| `principal_amount`    | `principalAmount`    |          | decimal                                                                |
| `terms_amount`        | `termsAmount`        |          | decimal                                                                |
| `terms_frequency`     | `termsFrequency`     |          | string                                                                 |
| `terms_length`        | `termsLength`        |          | integer                                                                |
| `outstanding_balance` | `outstandingBalance` | yes      | decimal                                                                |
| `days_past_due`       | `daysPastDue`        |          | integer                                                                |
| `missed_installments` | `missedInstallments` |          | integer                                                                |
| `last_payment_date`   | `lastPaymentDate`    |          | ISO date                                                               |
| `last_payment_amount` | `lastPaymentAmount`  |          | decimal                                                                |
| `negotiation_options` | `negotiationOptions` |          | JSON string — array of `{terms_amount, terms_frequency, terms_length}` |

`phone`, when present on a row, SHALL be normalized to E.164 (e.g. `+18091234567`) before being
written to `PortfolioAccount.phone`. A row whose `phone_number` cell cannot be parsed as a valid
international phone number SHALL fail import validation for the **entire batch** — no rows from
that sync call are written — consistent with how every other invalid field on a row (e.g. a
negative `outstanding_balance`) already fails the whole batch rather than silently persisting bad
data or skipping just that row.

#### Scenario: All fields round-trip through CSV import

- **WHEN** an operator imports a CSV row containing values for every column
- **THEN** the stored `PortfolioAccount` record contains all those values
- **AND** a subsequent account listing returns them unchanged

#### Scenario: Optional fields absent from CSV are stored as null

- **WHEN** an operator imports a CSV row with empty optional cells
- **THEN** those fields are stored as null on the account record
- **AND** no validation error is raised for missing optional fields

#### Scenario: Phone number is normalized to E.164 at import

- **WHEN** an operator imports a CSV row whose `phone_number` cell is `"1 (809) 123-4567"` (a
  national number with country calling code but non-canonical formatting) or already in E.164 form
  with extra whitespace
- **THEN** the stored `PortfolioAccount.phone` is the canonical E.164 form (e.g. `+18091234567`)

#### Scenario: Unparseable phone number fails the whole import

- **WHEN** a CSV sync call includes any row whose non-empty `phone_number` cell cannot be parsed as
  a valid international phone number
- **THEN** the sync call fails with a validation error identifying the offending row and field
- **AND** no rows from that sync call are written to the database, including otherwise-valid rows

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
- **AND** no contact log entry is written for that skip

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
