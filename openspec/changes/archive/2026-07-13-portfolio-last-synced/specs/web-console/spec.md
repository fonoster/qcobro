## ADDED Requirements

### Requirement: Portfolio list shows last synced time

The portfolio list page SHALL show a "last synced" column indicating the timestamp of the most recent completed CSV sync for each portfolio, formatted per the console's active locale.

#### Scenario: Portfolio has been synced

- **WHEN** an operator views the portfolio list
- **AND** a portfolio's `lastSyncedAt` is set
- **THEN** that portfolio's row shows the localized date/time of `lastSyncedAt`

#### Scenario: Portfolio has never been synced

- **WHEN** an operator views the portfolio list
- **AND** a portfolio's `lastSyncedAt` is `null`
- **THEN** that portfolio's row shows a localized "Never synced" placeholder instead of a date
