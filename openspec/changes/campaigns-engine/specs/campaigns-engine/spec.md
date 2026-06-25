## ADDED Requirements

### Requirement: Engine runtime and scheduling tick

The system SHALL run a campaigns engine inside the apiserver process as a periodic
`tick`. The engine SHALL be controlled by an `engine` configuration block in
`qcobro.json` with `enabled` (boolean) and `tickSeconds` (number) — disabled by default
in development and enabled in production. Each tick SHALL be single-flighted (a new tick
SHALL NOT start while the previous one is still running) and SHALL hold a single
Postgres advisory lock so that at most one engine instance dispatches at a time. Each
tick SHALL perform bounded work (a capped number of dispatches), carrying any remainder
to the next tick, so the engine never starves the HTTP server.

#### Scenario: Engine runs only when enabled

- **WHEN** the apiserver boots with `engine.enabled = false`
- **THEN** no tick is scheduled and no outreach is originated automatically

#### Scenario: Ticks do not overlap

- **WHEN** a tick is still running and the interval fires again
- **THEN** the new tick is skipped rather than run concurrently

#### Scenario: Graceful shutdown is safe

- **WHEN** the process receives a shutdown signal mid-tick
- **THEN** the engine stops scheduling new ticks and starts no new reservations
- **AND** any already-reserved-but-undispatched attempt is treated as a missed attempt,
  never re-dispatched on restart

### Requirement: Schedule-window gate

The engine SHALL dispatch for a campaign only when it is `ACTIVE` and currently inside
its schedule window, evaluated in the deployment timezone from `qcobro.json`. A campaign
is in-window when all hold: `startDate <= today <= endDate` (or `endDate` is null), the
local weekday is in `daysOfWeek` (ISO 1=Monday..7=Sunday), and the local time is within
`startTime`..`endTime`. Windows SHALL NOT span midnight (`startTime < endTime`). The
current time SHALL be obtained from an injectable clock so window evaluation is
deterministic under test.

#### Scenario: Outside the daily time window

- **WHEN** the engine ticks at a local time before `startTime` or after `endTime`
- **THEN** the campaign is skipped for that tick and its status is unchanged

#### Scenario: Wrong weekday

- **WHEN** the local weekday is not in the campaign's `daysOfWeek`
- **THEN** the campaign is skipped for that day

#### Scenario: Future start date

- **WHEN** a campaign is `ACTIVE` but `startDate` is in the future
- **THEN** the engine does not dispatch until `startDate` (no separate scheduled state)

### Requirement: Account eligibility funnel

For an in-window campaign, the engine SHALL select accounts from the campaign's
portfolios and SHALL exclude any account that: has no phone; has a global
`PortfolioAccount.intentStatus` of `INTENT_MET`, `WRONG_NUMBER`, or `OPT_OUT`; has a
global `PortfolioAccount.suppressUntil` in the future; has a campaign-local
`CampaignAccountState.suppressUntil` in the future; has reached
`maxAttemptsPerAccount`; or has reached `maxAttemptsPerDay` for the local day. The
day-of an account's attempts SHALL be derived from the local date of its
`lastAttemptAt` (no separate daily reset job). Eligible accounts SHALL be ordered by
least-recently-attempted first (`lastAttemptAt` ascending, never-attempted first) with a
stable tiebreaker so selection is deterministic. Each account's outcome for the tick
(dispatched, suppressed, skipped) and the reason SHALL be recorded for the tick report.

#### Scenario: Temporarily suppressed account is skipped, not finished

- **WHEN** an account's `CampaignAccountState.suppressUntil` is in the future
- **THEN** the engine skips it this tick with reason "promise"/"callback"
- **AND** the account becomes eligible again automatically once `suppressUntil` passes

#### Scenario: Daily cap resets across the local day boundary

- **WHEN** an account reached `maxAttemptsPerDay` yesterday (local time)
- **AND** the engine ticks today
- **THEN** the account's daily count is treated as zero and it is eligible again

#### Scenario: Globally suppressed account is excluded from every campaign

- **WHEN** an account's `intentStatus` is set (`INTENT_MET`/`WRONG_NUMBER`/`OPT_OUT`)
- **THEN** the engine excludes it from all campaigns until an operator clears it

### Requirement: At-most-once dispatch via reserve-before-send

The engine SHALL guarantee at-most-once dispatch per `(campaignId, portfolioAccountId)`:
it SHALL reserve the attempt in a transaction — locking the `CampaignAccountState` row
for that pair, re-validating eligibility, and incrementing the attempt counters — and
SHALL only call the provider **after** the transaction commits. The provider call SHALL
NOT be made inside the transaction. A consumed attempt SHALL NOT be compensated or
retried within the cycle.

#### Scenario: Crash between reserve and dispatch never double-dials

- **WHEN** the process crashes after the reserve transaction commits but before/while
  the provider call is made
- **THEN** on restart the account's attempt is already counted and is not re-dispatched
  in the same window (a missed attempt is acceptable; a double-dial is not)

#### Scenario: Concurrent manual and engine cannot double-reserve

- **WHEN** the engine and the manual flow both target the same `(campaign, account)`
  at the same time
- **THEN** the row lock serializes them and only one reservation succeeds for that slot

### Requirement: Per-channel pacing

The engine SHALL pace dispatch per channel using a token bucket whose rate is configured
deployment-wide in `qcobro.json` (e.g. calls-per-minute for voice, messages-per-minute
for SMS). Voice and SMS buckets SHALL be independent. The engine SHALL only dispatch
channels supported by `dispatchOutreach` (`VOICE_AI`, `VOICE_PRERECORDED`, `SMS`).

#### Scenario: Dispatch stops when the channel budget is exhausted

- **WHEN** a campaign's channel bucket has no tokens left this tick
- **THEN** the engine stops dispatching that campaign's accounts until the bucket refills

#### Scenario: Unsupported channel surfaces a readiness failure

- **WHEN** an `ACTIVE`, in-window campaign uses an `EMAIL` or `WHATSAPP` agent template
- **THEN** the engine skips the whole campaign with a readiness failure and burns no
  attempts

### Requirement: Two-tier failure handling

The engine SHALL distinguish readiness failures from per-call failures. A **readiness**
failure (channel not configured, empty number pool, voice agent not synced, unsupported
channel) SHALL be detected once per campaign per tick before any account is reserved, and
SHALL skip the entire campaign without consuming any attempts, recording a clear reason.
A **per-call** failure (the provider call/SMS errored for one account) SHALL leave the
already-reserved attempt consumed (at-most-once), SHALL NOT be retried within the cycle,
and SHALL NOT write a customer gestión. There SHALL be no retry queue; the account's next
scheduled attempt under the caps is its only retry. All failures SHALL appear in the tick
report and logs.

#### Scenario: Misconfigured campaign burns no attempts

- **WHEN** a campaign's channel is not configured/synced
- **THEN** the engine skips the campaign up-front and no account's attempt counters change

#### Scenario: Per-call provider error consumes the attempt

- **WHEN** a reserved dispatch fails at the provider
- **THEN** the attempt remains counted, no gestión is written, and the failure is reported

### Requirement: Automatic completion at end date

The engine SHALL transition a campaign from `ACTIVE` to `COMPLETED` once its `endDate`
has passed in the deployment timezone, using the existing guarded status transition. A
campaign with a null `endDate` SHALL run until an operator pauses or completes it. This
transition is housekeeping: the schedule-window gate already prevents dispatch past
`endDate`.

#### Scenario: Campaign auto-completes after its end date

- **WHEN** the engine ticks and a campaign's `endDate` is in the past (local time)
- **THEN** the campaign's status is set to `COMPLETED`

#### Scenario: Open-ended campaign keeps running

- **WHEN** a campaign has no `endDate`
- **THEN** the engine never auto-completes it

### Requirement: Tick report

Each tick SHALL produce a `TickReport` describing, per campaign, whether it was in-window
and, per account considered, the decision (dispatched / suppressed / skipped /
out-of-window / readiness-failure / dispatch-failed) with a reason, plus per-channel
budget usage. In production the report SHALL be emitted as a structured log; the same
report SHALL be the value that tests assert against (no test-only code paths).

#### Scenario: Report explains why an account was not contacted

- **WHEN** an account is excluded during a tick
- **THEN** the tick report contains that account with its exclusion reason

### Requirement: Simulation via channel emulators

The engine SHALL be runnable in simulation using **channel emulators** — test-support
doubles of the provider clients that record what would have been dispatched and return a
deterministic provider ref — injected in place of the real Fonoster/Twilio clients. In
simulation the engine SHALL run for real, including all database writes; only the channel
SHALL be faked. Emulators are test-support only and SHALL NOT be selectable in
production configuration. The canonical term for these doubles is "emulator".

#### Scenario: Simulated run writes the database and produces a report

- **WHEN** the engine ticks with channel emulators injected
- **THEN** reservations, counters, and gestiones are written exactly as in production
- **AND** the emulator records each would-be dispatch and the tick report is produced

#### Scenario: Integration test proves at-most-once under crash

- **WHEN** an integration test runs against a real database, simulating a crash between
  the reserve commit and the dispatch, then re-runs the tick
- **THEN** the emulator records exactly one dispatch per `(campaign, account)`

### Requirement: Manual outreach shares the engine accounting

A manual contact SHALL be a first-class campaign attempt: it SHALL be logged under the
campaign and SHALL update the same accounting the engine uses (`CampaignAccountState`
counters, `lastAttemptAt`, `PortfolioAccount` hot-path fields). A manual contact SHALL be
permitted as an operator override even when soft caps (`maxAttemptsPerDay`/
`maxAttemptsPerAccount`) would block the engine, but it SHALL still be counted so the
engine subsequently backs off that account.

#### Scenario: Manual contact counts toward the campaign

- **WHEN** an operator sends a manual contact for an account under a campaign
- **THEN** the campaign's attempt counters and `lastAttemptAt` are updated
- **AND** the engine does not separately dispatch that account while it is within caps
