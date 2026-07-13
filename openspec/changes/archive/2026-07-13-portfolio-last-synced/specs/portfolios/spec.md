## MODIFIED Requirements

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
