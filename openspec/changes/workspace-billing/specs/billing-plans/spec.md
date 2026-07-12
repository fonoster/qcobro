# billing-plans Specification (delta)

## ADDED Requirements

### Requirement: Plan catalog in configuration

The system SHALL read the plan catalog from a `billing` section of `qcobro.json`, validated by
Zod at startup. The section SHALL contain `enabled`, `currency`, Stripe credentials
(`secretKey`, `webhookSigningSecret`), `voiceDebitEstimateSeconds`, and an ordered `plans`
array where array order defines the upgrade path. Each plan SHALL declare a unique kebab-case
`key`, an i18n `name` object, `monthlyPrice`, `monthlyAllowance`, `stripePriceId`, and a
`rates` object. Workspace state (plan assignment, balances, Stripe IDs, rate overrides) SHALL
NOT live in configuration.

#### Scenario: Valid catalog loads

- **WHEN** `qcobro.json` contains a `billing` section with two plans each declaring all
  required fields and all seven meters
- **THEN** the config loads and the plans are available in declared order as the upgrade path

#### Scenario: Duplicate plan keys rejected

- **WHEN** two plans share the same `key`
- **THEN** startup validation fails with a structured error naming the duplicate key

### Requirement: Per-meter rate schemas

The `rates` object SHALL require exactly the seven meters `sms`, `email`, `whatsappMessage`,
`voicePrerecorded`, `voiceAi`, `whatsappVoicePrerecorded`, and `whatsappVoiceAi`. Message
meters (`sms`, `email`, `whatsappMessage`) SHALL accept only `perMessage`; voice meters SHALL
require `perMinute` and `increments` in `"initial/subsequent"` notation (positive integer
seconds). A rate object with fields from the wrong meter kind SHALL fail validation.

#### Scenario: Missing meter rejected

- **WHEN** a plan's `rates` omits `email`
- **THEN** startup validation fails identifying the plan key and the missing meter

#### Scenario: Increment on a message meter rejected

- **WHEN** a plan declares `sms: { perMessage: 0.008, increments: "15/15" }`
- **THEN** startup validation fails because message meters do not accept increments

### Requirement: Increment billing formula

Voice usage SHALL be billed against answered duration using the increment pair: zero billed
seconds when the call was never answered; the initial increment when answered duration is at
most the initial increment; otherwise `initial + ceil((duration − initial) / subsequent) ×
subsequent`. The amount SHALL be `billedSeconds × perMinute / 60`. With `"15/15"` increments
the canonical vectors are 1s→15s, 15s→15s, 16s→30s, 35s→45s, unanswered→0.

#### Scenario: Canonical 15/15 vectors

- **WHEN** answered durations of 1, 15, 16, and 35 seconds are priced under `"15/15"`
- **THEN** billed seconds are 15, 15, 30, and 45 respectively

#### Scenario: Unanswered call bills zero

- **WHEN** a dispatched call ends without ever being answered
- **THEN** billed seconds are 0 and no usage amount is charged

### Requirement: Money precision in micro-units

All persisted monetary amounts SHALL be integer micro-units of the billing currency
(1 unit = 10⁻⁶). Config rates SHALL be converted to micro-units at load time; arithmetic past
the config boundary SHALL be integer-only. Rounding to display or invoice precision SHALL
occur only at aggregation, never per record.

#### Scenario: Sub-cent rate preserved exactly

- **WHEN** 1,000 SMS records are written at a `perMessage` rate of 0.0004
- **THEN** the ledger total equals exactly 400,000 micro-units (0.40), with no per-record
  rounding drift

### Requirement: Enterprise rate overrides

Rate resolution SHALL honor per-workspace `rateOverrides` — a partial of the shared rates
schema stored on the workspace's billing state (not in configuration). When pricing a usage
record, an override for the meter SHALL take precedence over the plan rate; meters without
an override use the plan rate. Overrides SHALL validate against the same per-meter schemas
as the catalog.

#### Scenario: Override applies to one meter only

- **WHEN** a workspace on `starter` has `rateOverrides.voiceAi = { perMinute: 0.30,
increments: "60/6" }` and dispatches one voice-AI call and one SMS
- **THEN** the call is priced with the override's rate and increments and the SMS is priced
  from the `starter` plan
