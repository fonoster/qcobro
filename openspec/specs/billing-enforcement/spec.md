# billing-enforcement Specification

## Purpose

The hard-stop guarantee: how dispatch paths (engine tick and manual outreach)
gate on workspace credits, how voice estimates bound overshoot, and how
billing.enabled switches metering and gating off entirely.

## Requirements

### Requirement: Per-workspace credit bucket in the engine tick

At tick start the engine SHALL seed one credit bucket per workspace from the derived ledger
balance. A workspace whose balance is zero or negative SHALL have all its campaigns skipped
with reason `credits_exhausted`. Each dispatch SHALL first debit the bucket in memory:
message meters debit their exact unit price; voice meters debit the estimate defined by
`voiceDebitEstimateSeconds` at the workspace's effective rate, never less than the initial
increment. When the bucket cannot cover a debit, that account SHALL decide
`credits_exhausted` and the tick SHALL continue with other accounts and workspaces
unaffected.

#### Scenario: Exhausted workspace skipped at tick start

- **WHEN** a workspace's balance is ≤ 0 when a tick begins
- **THEN** every campaign in that workspace is skipped with reason `credits_exhausted` and
  other workspaces dispatch normally

#### Scenario: Mid-tick exhaustion stops at the account boundary

- **WHEN** a workspace's bucket empties partway through a campaign's account list
- **THEN** already-dispatched accounts stand, remaining accounts decide
  `credits_exhausted`, and the tick report records both

### Requirement: Bounded voice overshoot

The system SHALL NOT place new dispatches once the credit bucket is empty. Because voice
debits are estimates settled at call end, the workspace balance MAY go negative by at most
the sum of concurrent in-flight voice estimate errors, and the next tick's seed SHALL
reflect all settlements received.

#### Scenario: Overshoot bounded by in-flight calls

- **WHEN** the balance nears zero with N voice calls in flight
- **THEN** the final negative balance never exceeds N × (actual − estimated) cost and no new
  dispatch is placed after the bucket empties

### Requirement: Manual outreach balance check

Manual/ad-hoc outreach (dispatches outside the engine tick) SHALL perform a direct balance
check before dispatching and SHALL reject with a structured insufficient-credits error when
the balance cannot cover the dispatch, without side effects.

#### Scenario: Manual send rejected when exhausted

- **WHEN** an operator triggers ad-hoc outreach for a workspace with zero balance
- **THEN** the request fails with a structured insufficient-credits error and nothing is
  dispatched or recorded

### Requirement: Billing disabled bypasses metering and gating

When `billing.enabled` is `false`, dispatch paths SHALL neither write usage records nor
enforce credit gates, preserving pre-billing behavior for self-hosted deployments and
rollback.

#### Scenario: Disabled billing dispatches without accounting

- **WHEN** `billing.enabled` is `false` and a campaign tick runs
- **THEN** dispatches proceed with no usage records written and no `credits_exhausted`
  decisions possible
