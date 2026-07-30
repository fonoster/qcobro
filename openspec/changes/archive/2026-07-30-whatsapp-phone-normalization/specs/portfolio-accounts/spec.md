## MODIFIED Requirements

### Requirement: Account data fields

Each `PortfolioAccount` record SHALL carry the following fields derived from the CSV. Optional fields are omitted when the CSV cell is empty.

| CSV column            | Field                | Required | Type                                                                   |
| --------------------- | -------------------- | -------- | ---------------------------------------------------------------------- |
| `loan_id`             | `externalId`         | yes      | string                                                                 |
| `full_name`           | `fullName`           | yes      | string                                                                 |
| `phone_number`        | `phone`              |          | string, normalized to E.164 at write time (see below)                  |
| `preferred_language`  | `preferredLanguage`  |          | string (BCP-47, e.g. `es-DO`)                                          |
| `best_time_to_call`   | `bestTimeToCall`     |          | string                                                                 |
| `customer_segment`    | `customerSegment`    |          | string                                                                 |
| `principal_amount`    | `principalAmount`    |          | decimal                                                                |
| `terms_amount`        | `termsAmount`        |          | decimal                                                                |
| `terms_frequency`     | `termsFrequency`     |          | string                                                                 |
| `terms_length`        | `termsLength`        |          | integer                                                                |
| `outstanding_balance` | `outstandingBalance` | yes      | decimal                                                                |
| `days_past_due`       | `daysPastDue`        |          | integer                                                                |
| `missed_installments` | `missedInstallments` |          | integer                                                                |
| `last_payment_date`   | `lastPaymentDate`    |          | ISO date                                                               |
| `last_payment_amount` | `lastPaymentAmount`  |          | decimal                                                                |
| `negotiation_options` | `negotiationOptions` |          | JSON string — array of `{terms_amount, terms_frequency, terms_length}` |

`phone`, when present on a row, SHALL be normalized to E.164 (e.g. `+18091234567`) before being
written to `PortfolioAccount.phone`. A row whose `phone_number` cell cannot be parsed as a valid
international phone number SHALL fail import validation for the **entire batch** — no rows from
that sync call are written — consistent with how every other invalid field on a row (e.g. a
negative `outstanding_balance`) already fails the whole batch rather than silently persisting bad
data or skipping just that row.

#### Scenario: All fields round-trip through CSV import

- **WHEN** an operator imports a CSV row containing values for every column
- **THEN** the stored `PortfolioAccount` record contains all those values
- **AND** a subsequent account listing returns them unchanged

#### Scenario: Optional fields absent from CSV are stored as null

- **WHEN** an operator imports a CSV row with empty optional cells
- **THEN** those fields are stored as null on the account record
- **AND** no validation error is raised for missing optional fields

#### Scenario: Phone number is normalized to E.164 at import

- **WHEN** an operator imports a CSV row whose `phone_number` cell is `"1 (809) 123-4567"` (a
  national number with country calling code but non-canonical formatting) or already in E.164 form
  with extra whitespace
- **THEN** the stored `PortfolioAccount.phone` is the canonical E.164 form (e.g. `+18091234567`)

#### Scenario: Unparseable phone number fails the whole import

- **WHEN** a CSV sync call includes any row whose non-empty `phone_number` cell cannot be parsed as
  a valid international phone number
- **THEN** the sync call fails with a validation error identifying the offending row and field
- **AND** no rows from that sync call are written to the database, including otherwise-valid rows
