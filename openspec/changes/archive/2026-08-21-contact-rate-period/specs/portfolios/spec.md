## ADDED Requirements

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
