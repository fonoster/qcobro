## ADDED Requirements

### Requirement: Money is formatted for the workspace locale and currency

Every monetary amount the console renders — dashboard KPIs, portfolio tables, portfolio
detail, the payment-promise worklist, gestión detail, and outreach previews — SHALL be
formatted using **both** the active workspace's `currency` and its `locale`. The console
SHALL NOT format money against the UI language or against a hardcoded locale tag: grouping
and decimal separators differ between locales that share a language (`32.000` is thirty-two
thousand in `es-ES` and thirty-two in `es-DO`), so a language-derived locale silently
misstates amounts to the operator.

Amounts SHALL render fractional units only when the amount has them — no decimals for a
round amount, two decimals otherwise. This matches how `@qcobro/common` formats the amounts
rendered into outreach copy, so an amount an operator reads on screen and the amount a debtor
is told are the same number.

While workspace settings are still loading or unset, the console SHALL fall back to the
application default locale rather than to a language-derived tag.

#### Scenario: Amounts use the workspace locale's separators and symbol

- **GIVEN** a workspace whose locale is `es-DO` and whose currency is `DOP`
- **WHEN** the console renders an amount of 32000
- **THEN** it is displayed as `RD$32,000` — comma thousands separator and the localized
  currency symbol
- **AND** it is NOT displayed as `32.000 DOP`

#### Scenario: Locale does not follow the UI language

- **GIVEN** a workspace whose locale is `es-DO`
- **WHEN** an operator switches the console's UI language to English
- **THEN** amounts remain formatted for the workspace locale and currency
- **AND** only the surrounding labels change language

#### Scenario: Fractional units appear only when present

- **WHEN** the console renders an amount with no fractional part
- **THEN** no decimal separator or decimal digits are shown
- **WHEN** the console renders an amount with a fractional part
- **THEN** exactly two decimal digits are shown

## MODIFIED Requirements

### Requirement: Workspace settings — currency and timezone

The "Configuración del espacio" page SHALL let an operator view and edit the active
workspace's **currency** (`USD` | `DOP`) and **timezone** (IANA zone). Values are read and
saved through the workspace settings operation; all labels go through the i18n layer. The
portfolio create/edit form SHALL NOT offer a currency field — currency is set here, once,
for the whole workspace.

The workspace's `locale` is not offered on this page (see the `workspace-settings`
capability: it is application-managed while exactly one locale is supported), but it governs
money formatting across the console together with the chosen currency.

#### Scenario: Operator edits workspace currency and timezone

- **WHEN** an operator opens "Configuración del espacio" and saves a currency and timezone
- **THEN** the workspace settings are updated
- **AND** money across the console (dashboard, portfolios, payment promises) is formatted in
  the chosen currency, using the workspace's locale for grouping and decimal separators

#### Scenario: Portfolio form has no currency field

- **WHEN** an operator creates or edits a portfolio
- **THEN** the form does not present a currency selector
