## ADDED Requirements

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
