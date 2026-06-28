## ADDED Requirements

### Requirement: Workspace settings — currency and timezone

The "Configuración del espacio" page SHALL let an operator view and edit the active
workspace's **currency** (`USD` | `DOP`) and **timezone** (IANA zone). Values are read and
saved through the workspace settings operation; all labels go through the i18n layer. The
portfolio create/edit form SHALL NOT offer a currency field — currency is set here, once,
for the whole workspace.

#### Scenario: Operator edits workspace currency and timezone

- **WHEN** an operator opens "Configuración del espacio" and saves a currency and timezone
- **THEN** the workspace settings are updated
- **AND** money across the console (dashboard, portfolios, payment promises) is formatted in
  the chosen currency

#### Scenario: Portfolio form has no currency field

- **WHEN** an operator creates or edits a portfolio
- **THEN** the form does not present a currency selector
