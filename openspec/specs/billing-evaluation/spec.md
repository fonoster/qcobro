# billing-evaluation Specification

## Purpose

The billing module's verifiability: the in-memory scenario simulation and the
invariant scorecard (ledger conservation, increment vectors, margins, replay
idempotency) that judge it.

## Requirements

### Requirement: Billing simulation

The system SHALL provide a simulation script that drives synthetic dispatches (all seven
meters, including voice calls with varied answered durations and unanswered outcomes)
through the real pricing and ledger code using channel emulators, producing a ledger that
the evaluation can assert against — following the engine simulation pattern.

#### Scenario: Simulation produces a priced ledger

- **WHEN** the billing simulation runs a scenario of mixed dispatches for a workspace
- **THEN** usage records and ledger entries exist for every synthetic dispatch, priced by
  the configured plan

### Requirement: Evaluation invariants

The evaluation SHALL assert, at minimum: ledger conservation (the derived balance equals the
sum of entries, and total debits equal the sum of priced usage records, exact to the
micro-unit); the canonical increment vectors; that hard stop actually stops (no dispatch
after exhaustion); the voice overshoot bound; proration × allowance edge cases (mid-cycle
signup, mid-cycle upgrade, downgrade then cycle turnover); and a margin guard that every
configured rate exceeds its known provider floor.

#### Scenario: Ledger conservation holds

- **WHEN** the evaluation runs over a simulated multi-cycle scenario
- **THEN** derived balances equal entry sums exactly in micro-units, with zero rounding drift

#### Scenario: Hard stop verified

- **WHEN** a simulated workspace exhausts its allowance mid-scenario
- **THEN** the evaluation confirms no billable dispatch occurred after the bucket emptied,
  apart from settlements of calls already in flight

#### Scenario: Margin guard flags underwater rates

- **WHEN** a plan configures an SMS rate below the known provider floor
- **THEN** the evaluation reports a margin violation naming the plan and meter
