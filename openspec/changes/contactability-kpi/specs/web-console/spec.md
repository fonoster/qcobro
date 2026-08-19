## ADDED Requirements

### Requirement: Tasa de contacto reflects channels that actually worked

The Panel de control's contactability KPI ("Tasa de contacto") SHALL be the share of accounts
under management that have been reached at least once, computed from the contactability
statistic defined by the `portfolios` capability — accounts with at least one gestión whose
outcome proves the channel reached the destination, over all active accounts.

The KPI SHALL NOT be derived from whether an outreach attempt was dispatched. An account
whose every attempt failed, went unanswered, hit a wrong number, or is still awaiting its
channel result SHALL NOT be counted as contacted.

When there are no active accounts, the KPI SHALL read 0%.

#### Scenario: A workspace whose sends all failed reads 0%

- **GIVEN** a workspace whose every gestión is `NOT_DELIVERED`, `NO_ANSWER`, or `WRONG_NUMBER`
- **WHEN** an operator opens the Panel de control
- **THEN** "Tasa de contacto" reads 0%
- **AND** it does not read 100% on the strength of the attempts having been dispatched

#### Scenario: A just-dispatched campaign does not move the KPI

- **GIVEN** a campaign that has dispatched to every account and whose gestións are all still
  at the `DISPATCHED` placeholder
- **WHEN** an operator opens the Panel de control
- **THEN** "Tasa de contacto" reads 0%
- **AND** it rises as the channels' status callbacks finalize those gestións

## MODIFIED Requirements

### Requirement: Gestiones list page

The operator console SHALL have a "Gestiones" page accessible from the sidebar that lists
recorded outreach attempts (`AccountContactLog`) for the active workspace in a table. Each
row SHALL show the account/customer identity, the channel, the outcome, the AI summary of
what happened, and the contact timestamp, with a way to open the gestión detail. The table
SHALL be filterable by channel and by outcome. The table presentation is restrained
(monochrome channel indicator, plain-text outcome — no coloured pills).

The outcome filter SHALL offer `DISPATCHED` so an operator can find attempts that have left
QCobro but whose channel has not reported back, and its label SHALL read as a pending state
rather than as a result. The filter SHALL NOT offer a catch-all "Otro" option: no such
outcome exists, and an operator filtering by it would learn nothing about what happened.

#### Scenario: Operator opens a gestión from the list

- **WHEN** the operator clicks a row in the Gestiones list
- **THEN** the Detalle de gestión screen for that contact log opens

#### Scenario: Channel and AI summary are visible per row

- **WHEN** the Gestiones list renders a recorded attempt
- **THEN** the row shows the channel (e.g. SMS) and the AI summary of the attempt

#### Scenario: Pending attempts are filterable

- **WHEN** the operator filters the Gestiones list by the `DISPATCHED` outcome
- **THEN** the list shows attempts awaiting their channel result
- **AND** the outcome reads as pending
- **AND** no "Otro" option is offered anywhere in the filter
