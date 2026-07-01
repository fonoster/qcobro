## ADDED Requirements

### Requirement: Portfolio account detail dialog

The "Ver detalle" action on a row in a portfolio's accounts table SHALL open a dialog
showing the account's basic fields (outstanding balance, days past due, phone, email)
and a collapsed "Ver metadata" section. Expanding "Ver metadata" SHALL reveal every
other field on the account record — everything not already shown in the basic fields —
as a formatted JSON tree. The basic fields SHALL remain visible whether or not "Ver
metadata" is expanded.

#### Scenario: Operator opens the basic account detail view

- **WHEN** an operator clicks "Ver detalle" on an account row
- **THEN** a dialog opens showing the account's balance, days past due, phone, and email
- **AND** the "Ver metadata" section is present but collapsed

#### Scenario: Operator expands the full record

- **WHEN** an operator clicks "Ver metadata" in the account detail dialog
- **THEN** the remaining fields of the account record are shown as a JSON tree
- **AND** the basic fields remain visible above it

#### Scenario: Newly added account fields are visible without an app change

- **WHEN** the account record gains a new field not covered by the basic-fields summary
- **THEN** that field appears under "Ver metadata" once expanded, without requiring the
  dialog's basic-fields list to be updated
