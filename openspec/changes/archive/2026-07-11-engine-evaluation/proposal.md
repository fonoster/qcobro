## Why

The campaigns engine computes a rich `TickReport` every tick — per-campaign window/skip
outcomes and a per-account decision for every candidate — then discards it after a one-line
console log. Dispatch failures survive only as `console.error`. There is no way to prove,
after a run, that the engine performed within its parameters (windows, caps, rate limits,
suppression) or to measure how well it performed (latency, error rate, budget utilization).
As real campaigns ramp up, both engineering and collections operations need that proof.

## What Changes

- **Flight recorder**: the engine persists an append-only `EngineEvent` stream — tick
  start/complete, campaign evaluation, per-account funnel decisions, attempt reservation,
  dispatch request/success/failure (with latency and error class), and inbound provider
  events (voice conversation events, delivery callbacks) — every event carrying the
  correlation spine (`tickId`, `workspaceRef`, `campaignId`, `portfolioAccountId`,
  `providerRef`) plus
  wall-clock time and tick sequence number. Decisions are never sampled; only fat payloads
  (transcripts, rendered bodies) stay out of the stream (they already live on the gestión).
- **Deterministic judge**: a pure `evaluate(events, parameters)` function in
  `@qcobro/common` that replays an event stream against an invariant catalog and produces a
  `Scorecard`: safety invariants (no dispatch outside window, attempt caps respected,
  suppressed accounts never contacted, channel rate caps honored, at-most-once per
  reservation), performance thresholds (tick duration, dispatch latency, error rate, budget
  utilization), and liveness (eligible accounts attempted within N ticks). No I/O, no
  clock — bit-for-bit deterministic on the same input.
- **Simulation harness**: engine integration tests reuse the existing channel emulators and
  injected `Clock` to run scripted scenarios (failure rates, exhausted budgets, out-of-order
  webhooks) tick-by-tick, capture the same event stream, and assert the scorecard is green —
  one evaluator for CI simulations and production run exports alike.
- **Consumption**: no stored reports, no UI, nothing scheduled — evaluation is an
  occasional engineering check. An `engine-eval` bin published with `@qcobro/common` is
  run via `npx` against a new read-only `GET /api/engine/events` endpoint (defaults to
  `https://api.qcobro.com`, authenticated with an existing workspace API key and scoped
  to that key's workspace); the judge runs locally in the CLI and exits non-zero on
  failure. Documented in the README next to
  the `engine:sim` emulator instructions.
- **Retention**: engine events are pruned by age; the stream is telemetry, not a system of
  record (gestiones remain the record of contact attempts).
- Out of scope for v1: operator-facing run reports in the web console (the scorecard is an
  engineering artifact first; a compliance-facing UI can build on it later).

## Capabilities

### New Capabilities

- `engine-events`: capture and persistence of the engine event stream — event kinds,
  correlation fields, when each event is emitted, provider-event ingestion, retention.
- `engine-scorecard`: the deterministic evaluator — invariant catalog, parameter set,
  scorecard shape, determinism guarantee, and its use over both simulated and live runs.

### Modified Capabilities

<!-- none — the engine's dispatch behavior is unchanged; event emission and evaluation are
     additive capabilities -->

## Impact

- `mods/common`: new schemas/types for `EngineEvent`, evaluation parameters, and
  `Scorecard`; the pure `evaluate` function lives here (shared, dependency-free).
- `mods/common`: also ships the `engine-eval` bin (the package is published to npm, so it
  is npx-runnable against any deployment).
- `mods/apiserver`: Prisma model + migration for `engine_events`; emission hooks in
  `src/engine/engine.ts` / `runner.ts` (persist the existing `TickReport` rather than
  discard it) and in the provider webhook handlers (`src/voice`, REST callbacks); a
  read-only `GET /api/engine/events` REST endpoint authenticated with the existing
  API-key infrastructure; a pruning job keyed to a retention window in `qcobro.json`.
- `README.md`: the eval flow documented alongside the `engine:sim` emulator instructions.
- `mods/apiserver` tests: engine integration tests gain scorecard assertions on top of the
  existing emulator harness.
- No webapp changes in v1. No changes to dispatch semantics, reservation, or gestión writes.
