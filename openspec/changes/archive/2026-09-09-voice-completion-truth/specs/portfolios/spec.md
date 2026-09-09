## MODIFIED Requirements

### Requirement: Workspace contact rate is windowed and counted per account

The system SHALL expose a workspace-scoped contact statistic over a caller-selected period, one
of `24h`, `7d`, `14d` or `28d`, defaulting to `7d` when none is given. An unrecognized period
SHALL be rejected before the query runs.

Within the window `[now - period, now)`, measured against each gestión's `contactedAt`:

- the **denominator** SHALL be the number of **distinct** accounts having at least one gestión;
- the **numerator** SHALL be the number of **distinct** accounts having at least one gestión with
  `delivery` of `DELIVERED`;
- the system SHALL additionally return the total gestión count in the window, which is reporting
  volume and SHALL NOT participate in the ratio.

Each account SHALL count at most once on each side regardless of how many attempts it received.
Consequently, retrying an account that was not reached SHALL NOT lower the rate, and an account
reached on any attempt within the window SHALL count as reached exactly once. The statistic SHALL
NOT be computed per attempt, and SHALL NOT weight attempts by any configured attempt cap.

Reached SHALL be defined on `delivery` alone, and SHALL NOT depend on `path` or `outcome`: a
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
- **Reached** SHALL count those accounts having at least one gestión with `delivery`
  `DELIVERED`.

An account SHALL be counted at most once in each figure regardless of how many gestións it has.

Reached is defined on `delivery` alone and SHALL NOT be inferred from `path` or `outcome`:
delivery is the question being asked, and a delivered message that produced no interaction is
still a reached account. Equally, an account whose every attempt is `DISPATCHED` or `FAILED`
SHALL NOT be counted as reached — a message still in flight is not a contact.

#### Scenario: An account whose attempts all failed is not reached

- **WHEN** an account's only gestións have `delivery` `FAILED`
- **THEN** it counts toward under-management but not toward reached

#### Scenario: An account still awaiting delivery confirmation is not reached

- **WHEN** an account's only gestión is still at `delivery` `DISPATCHED`
- **THEN** it counts toward under-management but not toward reached

#### Scenario: A delivered attempt with no interaction still counts as reached

- **WHEN** an account has a gestión with `delivery` `DELIVERED`, `path` null, and `outcome`
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
