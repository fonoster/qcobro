## ADDED Requirements

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

After mutating account rows the transaction SHALL recompute and persist `accountCount` and `totalOutstandingBalance` on the parent portfolio.

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

#### Scenario: Sync runs atomically

- **WHEN** an error occurs mid-sync (e.g., a constraint violation on one row)
- **THEN** the entire operation is rolled back
- **AND** the portfolio's accounts and aggregate stats remain unchanged from before the sync

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
| `phone_number`        | `phone`              |          | string                                                                 |
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

#### Scenario: All fields round-trip through CSV import

- **WHEN** an operator imports a CSV row containing values for every column
- **THEN** the stored `PortfolioAccount` record contains all those values
- **AND** a subsequent account listing returns them unchanged

#### Scenario: Optional fields absent from CSV are stored as null

- **WHEN** an operator imports a CSV row with empty optional cells
- **THEN** those fields are stored as null on the account record
- **AND** no validation error is raised for missing optional fields
