## MODIFIED Requirements

### Requirement: Panel de control reads live workspace data

The Panel de control (home) SHALL source its activity and per-cartera widgets, and the
"Cuentas en gestión" KPI, from live workspace data rather than mock constants.

- "Gestiones recientes" SHALL list the most recent recorded outreach attempts
  (`AccountContactLog`) for the active workspace, each showing the account/customer
  identity, a human-readable outcome, and a relative timestamp.
- "Progreso por cartera" SHALL list the workspace's active carteras. Because no
  recovery-progress metric exists yet, each cartera's progress SHALL be a simulated value
  between 10% and 80%, derived deterministically from the cartera so it is stable across
  renders.
- The "Cuentas en gestión" KPI SHALL show the total number of accounts under management,
  computed as the sum of the active carteras' account counts.
- The contact-rate KPI SHALL show the windowed, account-level contact rate as a percentage,
  with a period control **inside that card**. The control SHALL offer 24 hours, 7, 14 and 28
  days and SHALL default to 7 days, and changing it SHALL re-read the statistic for the new
  window. Beneath the percentage the card SHALL show the accounts reached, the accounts
  attempted, and the total sends in the window, so a small sample is legible as a small sample
  rather than as a collapse.

  Periods SHALL be spelled out ("7 días"), both in the collapsed control and in the open menu.
  Because that control shares its row with the card's label, and five cards share the page row,
  the card's label SHALL be the short form ("Contacto" / "Contact") rather than a full "contact
  rate" phrase — the percentage already establishes that it is a rate. Below roughly a 1280px
  viewport the two still compete and the label truncates; widening the row is tracked
  separately.

The period control SHALL NOT be placed in the page header. Only this KPI responds to it; a
header control would imply the whole panel does.

When the selected window contains no gestiones at all, the card SHALL render an explicit
no-sends state rather than a percentage. It SHALL NOT render `0%`, which is indistinguishable
from having attempted contact and reached nobody.

The other KPI cards SHALL be unaffected by the period control and SHALL retain their existing
semantics.

#### Scenario: Recent gestiones reflect real attempts

- **WHEN** an operator opens the Panel de control
- **THEN** "Gestiones recientes" shows real recent contact-log entries for the workspace
- **AND** when there are no recorded attempts, the widget shows an empty state rather than
  mock rows

#### Scenario: Per-cartera progress is simulated within bounds

- **WHEN** the "Progreso por cartera" widget renders an active cartera
- **THEN** its progress value is between 10% and 80%
- **AND** the same cartera shows the same value across renders

#### Scenario: Contact rate defaults to a seven-day window

- **WHEN** an operator opens the Panel de control
- **THEN** the "Tasa de contacto" card shows the rate for the last 7 days
- **AND** its period control reads 7 days

#### Scenario: Changing the period re-reads only that card

- **WHEN** the operator changes the contact-rate card's period to 28 days
- **THEN** that card's percentage and counts are recomputed for the 28-day window
- **AND** the other KPI cards are unchanged

#### Scenario: A window with no sends is shown as empty, not as zero

- **WHEN** the selected window contains no gestiones for the workspace
- **THEN** the card shows a no-sends state instead of a percentage
- **AND** it does not display `0%`
