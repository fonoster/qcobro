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

### Requirement: Workspace contact rate is windowed and counted per account

The system SHALL expose a workspace-scoped contact statistic over a caller-selected period, one
of `24h`, `7d`, `14d` or `28d`, defaulting to `7d` when none is given. An unrecognized period
SHALL be rejected before the query runs.

Within the window `[now - period, now)`, measured against each gestión's `contactedAt`:

- the **denominator** SHALL be the number of **distinct** accounts having at least one gestión;
- the **numerator** SHALL be the number of **distinct** accounts having at least one gestión with
  `entrega` of `DELIVERED`;
- the system SHALL additionally return the total gestión count in the window, which is reporting
  volume and SHALL NOT participate in the ratio.

Each account SHALL count at most once on each side regardless of how many attempts it received.
Consequently, retrying an account that was not reached SHALL NOT lower the rate, and an account
reached on any attempt within the window SHALL count as reached exactly once. The statistic SHALL
NOT be computed per attempt, and SHALL NOT weight attempts by any configured attempt cap.

Reached SHALL be defined on `entrega` alone, and SHALL NOT depend on `camino` or `resultado`: a
delivered message that produced no interaction is still a reached account, and an account whose
attempts are all `DISPATCHED` or `FAILED` is not reached.

Gestiones SHALL be scoped to the workspace through the account's portfolio. The statistic SHALL
NOT filter on archived accounts or archived portfolios: it reports what happened during the
period, not what the book contains now.

#### Scenario: Retrying an unreached account does not lower the rate

- **WHEN** one account is delivered to on its only attempt, and a second account is attempted five
  times in the window without ever being delivered to
- **THEN** the denominator is 2 and the numerator is 1
- **AND** the total gestión count is 6

#### Scenario: An account reached on a later attempt counts as reached

- **WHEN** an account's first two attempts in the window did not deliver and its third did
- **THEN** the denominator is 1 and the numerator is 1

#### Scenario: Activity outside the window is excluded

- **WHEN** the only gestión for an account is 10 days old and the selected period is `7d`
- **THEN** the denominator, the numerator and the gestión count are all 0
- **AND** selecting `14d` instead includes it, giving a denominator and numerator of 1

#### Scenario: Period defaults to seven days

- **WHEN** the statistic is requested with no period
- **THEN** the window is 7 days

#### Scenario: Other workspaces are excluded

- **WHEN** a gestión in the window belongs to an account in another workspace
- **THEN** it contributes to neither count

#### Scenario: An unrecognized period is rejected

- **WHEN** the statistic is requested with a period outside the accepted set
- **THEN** a structured validation error is raised and no query runs

### Requirement: Workspace contactability statistic

The apiserver SHALL expose a workspace-scoped contactability statistic reporting two counts:
the accounts **under management**, and how many of them have been **reached at least once**.

- **Under management** SHALL count every non-archived `PortfolioAccount` belonging to a
  non-archived portfolio in the workspace. The portfolio filter is not cosmetic: the Panel de
  control's "Cuentas en gestión" KPI sums `portfolios.list`, which hides archived carteras, so
  counting their accounts here would make two KPIs on the same screen disagree about what is
  under management.
- **Reached** SHALL count those accounts having at least one gestión with `entrega`
  `DELIVERED`.

An account SHALL be counted at most once in each figure regardless of how many gestións it has.

Reached is defined on `entrega` alone and SHALL NOT be inferred from `camino` or `resultado`:
delivery is the question being asked, and a delivered message that produced no interaction is
still a reached account. Equally, an account whose every attempt is `DISPATCHED` or `FAILED`
SHALL NOT be counted as reached — a message still in flight is not a contact.

#### Scenario: An account whose attempts all failed is not reached

- **WHEN** an account's only gestións have `entrega` `FAILED`
- **THEN** it counts toward under-management but not toward reached

#### Scenario: An account still awaiting delivery confirmation is not reached

- **WHEN** an account's only gestión is still at `entrega` `DISPATCHED`
- **THEN** it counts toward under-management but not toward reached

#### Scenario: A delivered attempt with no interaction still counts as reached

- **WHEN** an account has a gestión with `entrega` `DELIVERED`, `camino` null, and `resultado`
  null
- **THEN** it counts toward reached

#### Scenario: An account is counted once despite many attempts

- **WHEN** an account has several `FAILED` gestións and one `DELIVERED` gestión
- **THEN** it counts exactly once toward reached

#### Scenario: A never-attempted account counts only toward the total

- **WHEN** an account has no gestións at all
- **THEN** it counts toward under-management and not toward reached

#### Scenario: Archived accounts and archived portfolios are excluded from both counts

- **WHEN** an account is archived, or belongs to an archived portfolio
- **THEN** it is excluded from both under-management and reached
