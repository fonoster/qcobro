# portfolios Specification

## Purpose

TBD - created by archiving change portfolio-management. Update Purpose after archive.

## Requirements

### Requirement: Portfolio CRUD scoped to workspace

The apiserver SHALL allow authenticated operators to create, read, update, and delete portfolios within their active workspace. All portfolio operations SHALL be scoped to the `workspaceRef` extracted from the caller's token — operators SHALL NOT be able to access portfolios belonging to a different workspace.

#### Scenario: Operator lists portfolios

- **WHEN** an authenticated operator requests their portfolio list
- **THEN** only portfolios belonging to their active workspace are returned
- **AND** portfolios are ordered by creation date descending

#### Scenario: Operator includes archived portfolios

- **WHEN** an authenticated operator lists portfolios with the include-archived flag set
- **THEN** archived portfolios are returned alongside active ones
- **AND** with the flag unset only active (non-archived) portfolios are returned

#### Scenario: Operator creates a portfolio

- **WHEN** an authenticated operator submits a name, clientId, and total amount
- **THEN** a new portfolio is created in their workspace in the active (non-archived) state
- **AND** account count and recovered amount default to zero

#### Scenario: Operator reads a portfolio

- **WHEN** an authenticated operator requests a portfolio by ID
- **THEN** the full portfolio record is returned including its associated campaigns
- **AND** if the portfolio does not belong to the caller's workspace the request is rejected with a not-found error

#### Scenario: Operator updates a portfolio

- **WHEN** an authenticated operator updates a portfolio's name
- **THEN** only the supplied fields are changed
- **AND** other fields remain unchanged

#### Scenario: Operator archives a portfolio

- **WHEN** an authenticated operator archives a portfolio
- **THEN** the portfolio's `archivedAt` timestamp is set
- **AND** the portfolio is excluded from the default list but remains accessible for historical reporting
- **AND** restoring it clears `archivedAt` and returns it to the default list

#### Scenario: Operator deletes a portfolio

- **WHEN** an authenticated operator deletes a portfolio
- **THEN** the portfolio and all its associated portfolio accounts are permanently removed
- **AND** the operation cannot be undone

### Requirement: Portfolio aggregate stats reflect current account data

The apiserver SHALL maintain `accountCount`, `totalOutstandingBalance`, and `lastSyncedAt` on each portfolio. `accountCount` and `totalOutstandingBalance` SHALL be updated atomically whenever accounts are synced and SHALL reflect the current state of the portfolio's account records at all times. `lastSyncedAt` SHALL be set to the time the sync completed, in the same transaction, and SHALL be `null` for a portfolio that has never been synced.

#### Scenario: Stats reflect account sync

- **WHEN** a CSV sync completes for a portfolio
- **THEN** the portfolio's `accountCount` equals the total number of accounts currently in the portfolio
- **AND** `totalOutstandingBalance` equals the sum of `outstandingBalance` across all accounts in the portfolio
- **AND** `lastSyncedAt` is set to the time the sync completed

#### Scenario: Stats are read-consistent

- **WHEN** two concurrent syncs are attempted on the same portfolio
- **THEN** both complete without corrupting the aggregate stats
- **AND** the final stats and `lastSyncedAt` reflect the last completed sync

#### Scenario: Portfolio has never been synced

- **WHEN** an operator reads or lists a portfolio that has not had a CSV sync performed
- **THEN** `lastSyncedAt` is `null`
