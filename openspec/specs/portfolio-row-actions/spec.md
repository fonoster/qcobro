# portfolio-row-actions Specification

## Purpose

TBD - created by archiving change portfolio-status-and-actions. Update Purpose after archive.

## Requirements

### Requirement: Portfolio status is three-valued

The system SHALL support three portfolio statuses: `ACTIVE`, `PAUSED`, and `ARCHIVED`.
`ACTIVE` means the portfolio is in active collections. `PAUSED` means collections are
temporarily halted. `ARCHIVED` means the portfolio is closed and hidden from default views.
The previous `CLOSED` status is replaced by `PAUSED` and `ARCHIVED`.

#### Scenario: Portfolio can be set to PAUSED

- **WHEN** an operator edits a portfolio and selects the Paused status
- **THEN** the portfolio status is saved as PAUSED
- **AND** the portfolio appears in the default list view

#### Scenario: Portfolio can be set to ARCHIVED

- **WHEN** an operator edits a portfolio and selects the Archived status
- **THEN** the portfolio status is saved as ARCHIVED
- **AND** the portfolio is hidden from the default list view

#### Scenario: CLOSED status no longer accepted

- **WHEN** a request is made to set a portfolio status to CLOSED
- **THEN** the system SHALL reject it with a validation error

### Requirement: Portfolio list default excludes ARCHIVED

The portfolio list SHALL default to showing only `ACTIVE` and `PAUSED` portfolios.
`ARCHIVED` portfolios SHALL only appear when the filter is explicitly set to show them.

#### Scenario: Default view omits ARCHIVED

- **WHEN** the portfolio list is loaded with no filter applied
- **THEN** only ACTIVE and PAUSED portfolios are returned
- **AND** ARCHIVED portfolios are not included in the results

#### Scenario: Filter can reveal ARCHIVED portfolios

- **WHEN** the operator selects "Archivadas" from the status filter
- **THEN** only ARCHIVED portfolios are returned

### Requirement: Portfolio row actions ellipsis menu

Each row in the portfolio list SHALL show a single ellipsis (⋯) button instead of
individual action buttons. Clicking it SHALL open a floating dropdown menu with three
actions: Sincronizar CSV, Editar, and Eliminar. Eliminar SHALL require a confirmation
dialog before executing.

#### Scenario: Ellipsis menu opens on click

- **WHEN** an operator clicks the ⋯ button on a portfolio row
- **THEN** a floating dropdown appears with options: Sincronizar CSV, Editar, Eliminar

#### Scenario: Sincronizar CSV opens the sync modal

- **WHEN** the operator selects Sincronizar CSV from the menu
- **THEN** the CSV sync modal opens for that portfolio

#### Scenario: Editar opens the edit modal

- **WHEN** the operator selects Editar from the menu
- **THEN** the edit portfolio modal opens pre-filled with the portfolio's current values

#### Scenario: Eliminar requires confirmation

- **WHEN** the operator selects Eliminar from the menu
- **THEN** a confirmation dialog is shown before the portfolio is deleted

#### Scenario: Menu closes when clicking outside

- **WHEN** a dropdown menu is open and the operator clicks elsewhere on the page
- **THEN** the menu closes without taking any action

### Requirement: Recovered amount is system-computed, not manually entered

The `recoveredAmount` field on a portfolio SHALL be computed automatically by the system
and SHALL NOT be editable by the operator. The system estimates recovery based on:

- Decreases in `outstandingBalance` on accounts since the previous CSV sync (indicating
  a payment was received; estimated as the difference applied against the principal)
- Accounts present in a previous sync but absent from a subsequent REPLACE-mode sync
  (treated as fully recovered — meaning the customer has paid all installments that
  were due up to that point, not necessarily the full outstanding principal of the loan)

This field is currently stored as a manually entered value and displayed read-only.
Auto-computation is deferred to a future change. Until then, the field SHALL remain
in the data model but SHALL NOT be exposed in any edit form.

#### Scenario: Edit modal does not expose recovered amount

- **WHEN** an operator opens the edit portfolio modal
- **THEN** no recovered amount input field is visible

#### Scenario: Recovered amount updates on sync

- **WHEN** a CSV sync completes (future implementation)
- **THEN** the system updates `recoveredAmount` based on balance deltas and archived accounts
- **AND** the operator cannot override this computed value

### Requirement: Delete action removed from edit modal

The EditPortfolioModal SHALL NOT contain a delete action. Deletion is only accessible
through the ellipsis menu on the portfolio list row.

#### Scenario: Edit modal has no delete button

- **WHEN** an operator opens the edit portfolio modal
- **THEN** no delete or danger-zone button is visible within the modal
