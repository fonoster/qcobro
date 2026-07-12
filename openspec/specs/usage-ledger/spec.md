# usage-ledger Specification

## Purpose

The durable accounting record of billable usage: priced-at-write-time usage
records, the signed ledger workspace balances derive from, and billing-cycle
open/close semantics (allowance grants, remainder voids, voice settlement).

## Requirements

### Requirement: Usage records priced at write time

Every billable dispatch SHALL write a `UsageRecord` in the same database transaction as the
dispatch's contact-log write, storing the meter, quantity, unit price, resolved amount in
micro-units, `workspaceRef`, and correlation fields (`campaignId` when present,
`providerRef`). The rate SHALL be resolved exactly once, at write time, from the workspace's
plan and overrides then in effect; subsequent plan or rate changes SHALL NOT alter existing
records. Usage records SHALL NOT be written through the engine event sink and SHALL NOT be
subject to event pruning.

#### Scenario: Rate change does not reprice history

- **WHEN** a usage record is written at 0.008 per SMS and the plan's SMS rate later changes
  to 0.010
- **THEN** the stored record still carries 0.008 and its original amount

#### Scenario: Failed ledger write fails the dispatch transaction

- **WHEN** the `UsageRecord` insert fails inside the dispatch transaction
- **THEN** the transaction rolls back and the dispatch is not recorded as succeeded

### Requirement: Ledger entries and balance derivation

The workspace balance SHALL be derived from a ledger of typed entries: allowance grants (+),
usage debits (−), voids (−), and settlement adjustments (±). The system SHALL be able to
recompute the balance from entries alone; any cached balance SHALL be an optimization, never
the source of truth.

#### Scenario: Balance equals entry sum

- **WHEN** a workspace has a 29.00 grant, usage debits totaling 12.50, and a settlement
  adjustment of −0.30
- **THEN** its derived balance is exactly 16.20 in micro-units

### Requirement: Cycle open and close

At each billing-cycle boundary the system SHALL close the previous cycle by voiding the
unused allowance remainder (no rollover) and open the new cycle with a grant of the plan's
`monthlyAllowance` (prorated when the cycle fragment is partial). Cycle turnover SHALL be
idempotent per `(workspaceRef, stripeInvoiceId)` so webhook replays do not double-grant or
double-void.

#### Scenario: Remainder voids at cycle close

- **WHEN** a cycle closes with 4.20 of the allowance unspent
- **THEN** a void entry of −4.20 is written and the new cycle starts from the fresh grant only

#### Scenario: Replayed invoice webhook is a no-op

- **WHEN** the same `invoice.paid` event is delivered twice for a workspace's cycle
- **THEN** exactly one void and one grant are recorded for that cycle

### Requirement: Voice estimate and settlement

A voice dispatch SHALL debit an estimated amount at dispatch time (per billing-enforcement)
and, when the call completes, SHALL be settled by a signed adjustment entry so the net ledger
effect equals the increment-billed amount for the answered duration. A call reported as never
answered SHALL settle to a net charge of zero.

#### Scenario: Longer call settles upward

- **WHEN** a voice-AI call was debited at a 60-second estimate and completes with 95 answered
  seconds under `"15/15"`
- **THEN** an adjustment is written such that the net charge equals 105 billed seconds at the
  plan rate

#### Scenario: Unanswered call settles to zero

- **WHEN** a voice call was debited at the estimate and completes unanswered
- **THEN** the settlement adjustment fully reverses the estimated debit
