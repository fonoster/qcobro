## 1. Contracts in @qcobro/common

- [x] 1.1 Define the `EngineEvent` Zod discriminated union (tick.started, tick.completed, campaign.evaluated with config snapshot, account.decided, attempt.reserved, dispatch.requested/succeeded/failed, provider.event) with the correlation spine (tickId, seq, workspaceRef, campaignId, portfolioAccountId, providerRef, channel, at); workspaceRef on all non-tick events
- [x] 1.2 Define `EvaluationParameters` (rate caps, tickSeconds, p95 latency, max error rate, liveness ticks — with defaults) and the `Scorecard` shape (overall verdict; per-invariant id + scope + verdict + metric + violations carrying campaignId/portfolioAccountId/eventIds; per-campaign breakdown; stream gaps)
- [x] 1.3 Define the `EngineEventSink` interface and a recipient-masking helper (last 4 digits); unit-test the masking

## 2. Judge (pure evaluator in @qcobro/common)

- [x] 2.1 Implement `evaluate(events, parameters)` scaffolding: stream indexing by tick/workspace/campaign/account, stream-gap detection, per-campaign breakdown, scorecard assembly (SAF-5/PERF-1 from deployment-level tick aggregates)
- [x] 2.2 Implement safety invariants SAF-1..SAF-6 (window from snapshots, lifetime/daily caps in workspace tz, suppression, rate cap with perTickCapacity semantics, at-most-once reservation pairing)
- [x] 2.3 Implement performance checks PERF-1..PERF-4 (tick duration, latency p95, error rate, budget utilization) and liveness LIVE-1
- [x] 2.4 Unit-test the judge: determinism (same input → deep-equal scorecards), one green fixture, and one red fixture per invariant (including SAF-5 window-edge boundary cases)

## 3. Flight recorder (apiserver capture)

- [x] 3.1 Prisma migration: `engine_events` table + `EngineEventKind` enum, indexes on (tickId), (campaignId, at), (providerRef), (at)
- [x] 3.2 Implement the Prisma-backed `EngineEventSink` (batched createMany, catch-log-drop on failure) and an in-memory sink for tests
- [x] 3.3 Add a `TickRecorder` and emit tick lifecycle events from `engine.ts`: tick.started/completed, campaign.evaluated with config snapshot, account.decided, attempt.reserved, dispatch.requested/succeeded/failed with latency and error class
- [x] 3.4 Flush the recorder from `runner.ts` after each tick (best-effort; sink failure never fails the tick) and wire the sink in `start.ts`
- [x] 3.5 Emit `provider.event` from the inbound handlers (voiceEvents, contactLogs callback surface, whatsAppWebhook, emailInbound) with source, provider/receipt timestamps, matched flag — unmatched events still recorded

## 4. Retention + config

- [x] 4.1 Add `engine.eventsRetentionDays` to the qcobro.json schema in `@qcobro/common` (default 30, 0 = keep forever) and to `config/qcobro-prod.json`
- [x] 4.2 Opportunistic pruning from the runner (at most hourly, bounded deleteMany); test that expired events are removed and newer ones kept

## 5. Simulation harness + CLI

- [x] 5.1 Extend the engine integration harness to capture events via the in-memory sink and assert `evaluate` returns green on the existing multi-tick scenarios
- [x] 5.2 Add red-path simulations: scripted channel failures above the error threshold (PERF-3) and a budget-starvation scenario (PERF-4/LIVE-1) asserting the matching red verdicts
- [x] 5.3 Add the read-only `GET /api/engine/events` REST endpoint (range fetch + engine parameters) authenticated with the existing API-key infra (Basic accessKeyId:accessKeySecret validated via Identity) and scoped to the key's workspace (own events + deployment-level tick events); test valid-key, invalid/missing-key, and cross-workspace-isolation paths
- [x] 5.4 Add the `engine-eval` bin to `@qcobro/common` (--url defaulting to https://api.qcobro.com, --from/--to defaulting to today in local tz, key pair via flags or QCOBRO*ACCESS_KEY*\* env vars, threshold flags with defaults, human summary + --json, non-zero exit on fail) and verify it runs via npx against a local apiserver
- [x] 5.5 Document the eval flow in README's "Running the campaigns engine" section alongside the `engine:sim` emulator instructions

## 6. Verification

- [x] 6.1 Run lint, typecheck, and the full unit + integration suites; confirm no dispatch-path behavior changed (existing engine tests untouched and green)
- [x] 6.2 Sink-failure drill: integration test where the sink throws and the tick still dispatches and records gestiones
