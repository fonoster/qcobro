## MODIFIED Requirements

### Requirement: CSV import with configurable sync mode

The apiserver SHALL accept a batch of account rows and a sync mode, then upsert the accounts into the portfolio within a single transaction. The three supported modes are:

APPEND_ONLY, UPDATE_EXISTING, and REPLACE. On successful completion of the transaction, the apiserver SHALL also stamp the parent portfolio's `lastSyncedAt` with the completion time.

#### Scenario: Append-only sync skips existing accounts

- **WHEN** an operator syncs with mode APPEND_ONLY and the batch contains rows with both new and existing loan_ids
- **THEN** new loan_ids are created and existing loan_ids are left unchanged

#### Scenario: Update-existing sync updates matched accounts

- **WHEN** an operator syncs with mode UPDATE_EXISTING and the batch contains rows with both new and existing loan_ids
- **THEN** existing loan_ids are updated with the incoming values and new loan_ids are created

#### Scenario: Replace sync archives accounts absent from the batch

- **WHEN** an operator syncs with mode REPLACE and the batch contains a set of loan_ids that partially overlaps the current portfolio
- **THEN** loan_ids present in the batch are created or updated and loan_ids absent from the batch are archived

#### Scenario: Un-archiving on re-sync

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
