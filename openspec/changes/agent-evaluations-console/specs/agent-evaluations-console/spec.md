## ADDED Requirements

### Requirement: Scenarios are reusable, persisted, workspace- and template-scoped

The console SHALL let an operator create, edit, list, and delete a `Scenario` — a saved
account context plus an ordered list of turns (each optionally carrying an `expected`
assertion) — owned by exactly one `AgentTemplate` in the active workspace. A `Scenario` SHALL
only be creatable for an `AgentTemplate` of type `VOICE_AI`, `EMAIL`, or `WHATSAPP`. A saved
scenario's stored definition SHALL be the exact shape the evaluation engine's `scenarios`
input already accepts, so running a saved scenario requires no reshaping.

#### Scenario: Creating a scenario for an unsupported channel is rejected

- **WHEN** an operator attempts to create a scenario against an `SMS` or `VOICE_PRERECORDED`
  agent template
- **THEN** the request is rejected with a structured error and no `Scenario` row is created

#### Scenario: A saved scenario is listed under its owning template

- **WHEN** an operator views an agent template's Escenarios tab
- **THEN** every `Scenario` owned by that template in the active workspace is listed

#### Scenario: Deleting a scenario does not delete its run history

- **WHEN** an operator deletes a `Scenario` that has one or more past `EvaluationRun`s
- **THEN** the `Scenario` row is removed
- **AND** each associated `EvaluationRun`'s snapshot fields (ref, description, account) remain
  intact and viewable

### Requirement: Running a saved scenario persists a durable `EvaluationRun`

Triggering a run against a saved `Scenario` SHALL create an `EvaluationRun` record before the
first event streams, update it incrementally as events arrive, and finalize it with an overall
verdict, pass/fail turn counts, and the full ordered event stream when the run concludes — all
without changing the shape or timing of the events streamed to the caller. The console SHALL
send exactly one scenario per run; the underlying evaluation engine's support for multiple
scenarios in one call is not exposed through the console in this capability.

#### Scenario: A run is visible in history immediately after starting

- **WHEN** an operator triggers a run against a saved scenario
- **THEN** an `EvaluationRun` with status `RUNNING` appears in that template's run history
  before the run's first turn result has streamed

#### Scenario: A completed run records its verdict and turn counts

- **WHEN** a run finishes with all turns graded
- **THEN** the `EvaluationRun`'s status becomes `COMPLETE`, its verdict reflects the terminal
  summary event's overall pass/fail, and its passed/total turn counts match the streamed
  per-turn results

#### Scenario: A run that errors before completing is recorded, not lost

- **WHEN** a run's evaluation engine raises an error before a terminal summary event streams
- **THEN** the `EvaluationRun`'s status becomes `ERROR`, retaining whatever events streamed
  before the failure

#### Scenario: A run interrupted by a dropped connection is recorded, not left running forever

- **WHEN** the client disconnects or unsubscribes before a run's terminal summary event streams
- **THEN** the `EvaluationRun`'s status becomes `INTERRUPTED`, retaining whatever events
  streamed before the disconnect, rather than remaining `RUNNING` indefinitely

### Requirement: Run results render turn-by-turn with pass/fail, tool calls, and judge reasoning

A run's detail view SHALL render each streamed turn as it arrives (for a live run) or as
stored (for a past run) identically — an input, a pass/fail indicator when the turn was
graded, any tool-call evaluations, and any judge failure reason — using the same rendering for
both a currently-streaming run and a historical one.

#### Scenario: A live run's turns render incrementally

- **WHEN** an operator is viewing a run that is still in progress
- **THEN** each turn's result renders as its event arrives, before the run's terminal summary
  event

#### Scenario: A failed turn surfaces its reason

- **WHEN** a turn's result reports `passed: false` with an `errorMessage` (a mismatch or a
  judge's failure reason)
- **THEN** the run detail view displays that reason alongside the turn, without requiring the
  operator to re-run the scenario to see why it failed

#### Scenario: Tool-call evaluations are visible per turn

- **WHEN** a turn's result includes one or more tool-call evaluations
- **THEN** each expected tool, whether it was actually invoked, and whether it passed are
  displayed for that turn

### Requirement: A run's report can be viewed in-app and downloaded

The console SHALL render a completed `EvaluationRun`'s pass/fail summary and per-turn detail
in-app, and SHALL let an operator download the same run as a report file, reusing the
evaluation engine's existing report-building logic rather than a separate implementation.

#### Scenario: Downloading a run produces the same data as the in-app view

- **WHEN** an operator downloads a completed run's report
- **THEN** the downloaded report's summary and per-turn results match what the in-app run
  detail view displays for that same run

### Requirement: SMS and VOICE_PRERECORDED templates get a render-only preview, not scenarios

For an `SMS` or `VOICE_PRERECORDED` agent template, the console SHALL offer a preview panel
that renders the template's output against a sample account, using the evaluation engine's
existing render-only preview — with no scenario creation, no run history, and no pass/fail
scoring, since these channels have no conversation to evaluate.

#### Scenario: Preview renders without creating any persisted record

- **WHEN** an operator previews an `SMS` or `VOICE_PRERECORDED` template against a sample
  account
- **THEN** the rendered output displays
- **AND** no `Scenario` or `EvaluationRun` row is created

#### Scenario: Escenarios/Ejecuciones tabs are not offered for preview-only channels

- **WHEN** an operator views an `SMS` or `VOICE_PRERECORDED` agent template's detail page
- **THEN** the Escenarios and Ejecuciones tabs are not present; only the Vista previa tab is
  offered alongside the existing Configuración/Campañas tabs
