## ADDED Requirements

### Requirement: Evaluation is a pure, deterministic function

`@qcobro/common` SHALL provide an `evaluate(events, parameters)` function that computes a
scorecard from an engine event stream and an evaluation parameter set, performing no I/O
and reading no clock, such that the same inputs always produce an identical scorecard.

#### Scenario: Same input, same scorecard

- **WHEN** `evaluate` is called twice with the same event stream and parameters
- **THEN** both calls return deeply equal scorecards

### Requirement: Safety invariants are verified over the stream

The evaluator SHALL check, from events alone (using the config snapshots they carry): no
dispatch outside the campaign's contact window (SAF-1); per-account lifetime attempt caps
respected (SAF-2); per-account daily attempt caps respected in the workspace timezone
(SAF-3); no dispatch to an account the funnel had suppressed (SAF-4); per-channel dispatch
rate never exceeding the configured per-minute cap under the engine's per-tick capacity
semantics (SAF-5); and at-most-once dispatch — every dispatch preceded by exactly one
reservation and no reservation dispatched twice (SAF-6). SAF-5 SHALL be evaluated from the
deployment-level tick events (aggregate per-tick channel counts) so it remains verifiable
on a workspace-scoped stream. Each violation SHALL identify the invariant and the
offending events.

#### Scenario: Out-of-window dispatch is flagged

- **WHEN** the stream contains a `dispatch.requested` whose timestamp falls outside the
  window in that campaign's snapshot
- **THEN** the scorecard fails SAF-1 and the violation references the offending dispatch
  event

#### Scenario: Cap-respecting run passes

- **WHEN** the stream contains dispatches that all fall within windows, caps, and rate
  budgets
- **THEN** every safety invariant in the scorecard reports pass with no violations

#### Scenario: Rate-cap breach is flagged

- **WHEN** the stream contains more dispatches on one channel than the per-minute cap
  allows under per-tick capacity semantics
- **THEN** the scorecard fails SAF-5

### Requirement: Performance is measured against configurable thresholds

The evaluator SHALL compute and judge against thresholds from the parameter set: tick
duration versus the tick interval (PERF-1), dispatch latency p95 (PERF-2), per-channel
dispatch error rate (PERF-3), and budget utilization — no account skipped as
`budget_exhausted` in a tick whose channel budget went unspent (PERF-4). Measured values
SHALL appear in the scorecard alongside each verdict.

#### Scenario: Excess error rate fails the scorecard

- **WHEN** the fraction of `dispatch.failed` events on a channel exceeds the configured
  maximum error rate
- **THEN** the scorecard fails PERF-3 and reports the measured rate

#### Scenario: Under-dispatch is detected

- **WHEN** a tick records `budget_exhausted` decisions for a channel whose
  `tick.completed` usage shows unspent budget
- **THEN** the scorecard fails PERF-4

### Requirement: Liveness is verified

The evaluator SHALL fail LIVE-1 when an account that the stream shows as eligible (a
non-suppressed decision or unspent-budget skip) receives no dispatch attempt within the
configured number of subsequent in-window ticks.

#### Scenario: Starved account is flagged

- **WHEN** an account is skipped as `budget_exhausted` for more than the configured number
  of consecutive in-window ticks without ever being dispatched
- **THEN** the scorecard fails LIVE-1 identifying the account

### Requirement: Scorecard reports verdicts, violations, and stream gaps

The scorecard SHALL contain an overall verdict and, per invariant, its id, its scope
(workspace or deployment), its verdict, the measured metric where applicable, and the
violations. Every violation SHALL be traceable through the correlation spine: it SHALL
reference the offending event ids and, where applicable, the campaign and portfolio
account. The scorecard SHALL include a per-campaign breakdown (campaign display name from the
stream, ticks seen, accounts considered, dispatched, failed, suppressed, and violations
per campaign). Incomplete ticks
(a `tick.started` without a matching `tick.completed`) SHALL be reported as stream gaps
distinct from invariant violations.

#### Scenario: Violation traces to campaign, account, and events

- **WHEN** the scorecard reports a suppression violation
- **THEN** the violation names the campaign, the portfolio account, and the event ids of
  the decision and dispatch events that evidence it

#### Scenario: Per-campaign breakdown is present

- **WHEN** a stream covering multiple campaigns is evaluated
- **THEN** the scorecard contains one breakdown row per campaign with its considered,
  dispatched, failed, and suppressed counts and any violations attributed to it

#### Scenario: Stream gap is reported, not failed

- **WHEN** the stream contains a `tick.started` with no matching `tick.completed`
- **THEN** the scorecard lists a stream gap for that tick and no invariant fails solely
  because of the missing events

### Requirement: Simulated runs are evaluated with the same function

The engine integration harness SHALL produce event streams that `evaluate` accepts
unchanged — channel emulators, injected clock, in-memory event sink — so scripted
scenarios can assert a green scorecard in CI, and scripted violations can assert the
corresponding red verdict.

#### Scenario: Green simulation

- **WHEN** a scripted multi-tick simulation runs within all parameters
- **THEN** evaluating its captured stream yields an overall pass

#### Scenario: Scripted fault is caught

- **WHEN** a simulation scripts channel failures above the error-rate threshold
- **THEN** evaluating its captured stream fails PERF-3

### Requirement: A deployment can be evaluated with npx

`@qcobro/common` SHALL ship an `engine-eval` bin, runnable via `npx` against a
deployment's API: it fetches the event stream and engine parameters from the events
endpoint, runs `evaluate` locally, and prints the scorecard as a human-readable summary
with a `--json` option, exiting non-zero when the overall verdict is fail. The API URL
SHALL default to `https://api.qcobro.com` (overridable with `--url`); the API key pair
SHALL be accepted as `--access-key-id` / `--access-key-secret` flags or the
`QCOBRO_ACCESS_KEY_ID` / `QCOBRO_ACCESS_KEY_SECRET` environment variables. When no
`--from`/`--to` range is passed, the CLI SHALL evaluate today's engine runs (the current
day in the operator's local timezone). It SHALL require no repository checkout, database
access, or config file; thresholds are flags with defaults.

#### Scenario: Evaluating a specific range from a laptop

- **WHEN** the operator runs `npx -p @qcobro/common engine-eval` with an API key pair and
  a from/to range covering persisted events
- **THEN** the CLI prints a scorecard for exactly that range and exits non-zero when the
  overall verdict is fail

#### Scenario: No range defaults to today

- **WHEN** the operator runs `engine-eval` with credentials but no from/to flags
- **THEN** the CLI evaluates the events from the current day in the operator's local
  timezone against the production default URL

#### Scenario: A newer judge evaluates an older deployment

- **WHEN** a newer `@qcobro/common` version with additional invariants is run via npx
  against a deployment shipping an older engine
- **THEN** the fetched stream is evaluated with the newer invariant catalog without any
  server-side change
