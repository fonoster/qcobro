## Context

Every engine tick already computes a `TickReport` (`mods/common/src/types/engine.ts`):
per-campaign window/skip/readiness outcomes and a per-account `AccountDecision` for every
candidate, with `providerRef` on dispatches. `runner.ts` logs one summary line and discards
it. Dispatch failures survive only as `console.error` (`engine.ts` `reserveAndDispatch`).
Inbound provider signals (voice conversation events, delivery callbacks, email/WhatsApp
webhooks) enrich gestiones but leave no run-level trace: nothing records _when_ the engine
knew what, so there is no way to verify after the fact that a run stayed within its
parameters, nor to measure latency, error rate, or budget utilization.

The engine is already built for determinism: it takes an injectable `Clock`, and
`emulators.ts` stands in every provider with deterministic refs. The integration tests
(`engine.integration.test.ts`) assert ad hoc on emulator arrays and the in-memory report.

## Goals / Non-Goals

**Goals:**

- Persist every engine signal as an append-only, correlated event stream (the flight
  recorder) with negligible impact on the dispatch hot path.
- A pure, deterministic `evaluate(events, parameters) → Scorecard` (the judge) in
  `@qcobro/common` that proves safety invariants and measures performance against
  thresholds — the same function for CI simulations and production run exports.
- Make the event stream self-contained: evaluating a run must not require joining back to
  live campaign rows (which may have been edited since).
- Reuse the emulator + fake-clock harness so integration tests assert "scorecard is green".

**Non-Goals:**

- No operator-facing UI, compliance reports, or webapp changes (v1 is an engineering
  artifact; a compliance UI can build on the stream later).
- No change to dispatch semantics, reservation (at-most-once), or gestión writes.
- No external analytics store (ClickHouse, OTel backend); no sampling infrastructure.
- Not a system of record — gestiones remain the record of contact attempts.

## Decisions

### 1. Storage: a Prisma `EngineEvent` table in the same Postgres

One partition-free append-only table, typed correlation columns + JSON payload:

```
engine_events
  id           uuid pk
  tickId       uuid?        -- null for provider events (they arrive outside a tick)
  seq          int?         -- monotonic within a tick (logical order)
  kind         EngineEventKind (enum)
  at           timestamptz  -- engine clock for tick events; receipt time for provider events
  workspaceRef string?      -- null only for tick lifecycle events (deployment-level)
  campaignId   string?      -- correlation spine, indexed where queried
  portfolioAccountId string?
  providerRef  string?
  channel      string?
  payload      Json         -- kind-specific body (validated by Zod in common)
  createdAt    timestamptz default now()
```

`workspaceRef` is part of the correlation spine: every campaign-, account-, dispatch-, and
provider-scoped event carries it (the engine already resolves the campaign's
`workspaceRef` per tick). Only `tick.started`/`tick.completed` are deployment-level — one
engine loop ticks across all workspaces, so tick timing and budgets have no owner.

_Why not JSONL files or an external store:_ same-DB keeps deployment unchanged (one
Postgres, config via `qcobro.json`), is queryable with the gestiones next door, and the
judge takes a plain array so the storage choice is swappable later. _Why typed columns +
JSON payload:_ the correlation spine is what queries filter on; per-kind bodies evolve too
fast for columns.

### 2. Event vocabulary: a Zod discriminated union in `@qcobro/common`

Kinds (v1, exhaustive):

- `tick.started` — tick id, budgets granted per channel (from the token buckets).
- `tick.completed` — duration ms, totals, per-channel `ChannelUsage`.
- `campaign.evaluated` — inWindow / skipReason / completed, candidate count, **and a config
  snapshot**: schedule fields, caps, timezone, channel. The snapshot makes the stream
  self-contained (Decision 4).
- `account.decided` — the existing `AccountDecisionEntry` verbatim (decision + providerRef).
- `attempt.reserved` — campaign/account, reservation timestamp.
- `dispatch.requested` / `dispatch.succeeded` / `dispatch.failed` — channel, to (masked to
  last 4 digits), latency ms, provider ref on success, error class + message on failure.
- `provider.event` — source (`voice-events`, `twilio-status`, `meta-whatsapp`,
  `email-inbound`), provider ref, provider-side timestamp when present **and** receipt
  time (the delta is a first-class signal), matched/unmatched flag, compact body.

Fat payloads (transcripts, rendered message bodies) are excluded — they already live on the
gestión (`channelData`, transcript fields). Decisions are never sampled.

### 3. Emission: collect in memory per tick, flush once; sink is injectable and best-effort

A `TickRecorder` (created per tick, timestamps via the injected `Clock`, assigns `seq`)
collects events as the existing code paths run; the runner flushes them with **one**
`createMany` after the tick settles. Provider webhook handlers write directly through the
same `EngineEventSink` interface on receipt.

`EngineEventSink` is an engine dependency like `Clock`: Prisma-backed in production,
in-memory in tests, no-op when disabled. **A sink failure never fails the tick or a
dispatch** — it is caught, logged, and dropped (telemetry, not record). _Trade-off:_ a
crash mid-tick loses that tick's events; acceptable because gestiones are the record.

_Why not per-event writes:_ a tick can produce hundreds of decisions; one batched insert
keeps the hot path free of write amplification. _Why not transactional with dispatch:_
coupling telemetry durability to dispatch would invert the priority.

### 4. Self-contained stream: config snapshots ride on the events

The window/caps invariants need the campaign's schedule, caps, and workspace timezone _as
they were during the run_. Rather than joining live rows at evaluation time (broken by
later edits, impossible for exported streams), `campaign.evaluated` embeds the snapshot.
`evaluate` takes only `(events, parameters)` — no second data source.

### 5. The judge: pure `evaluate(events, parameters)` in `@qcobro/common`

No I/O, no clock, no randomness — bit-for-bit deterministic. Invariant catalog v1:

| ID     | Invariant                                                             | Checked from                                                    |
| ------ | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| SAF-1  | No dispatch outside the campaign window                               | `dispatch.requested` vs snapshot schedule+tz                    |
| SAF-2  | `maxAttemptsPerAccount` never exceeded                                | `attempt.reserved` count per account                            |
| SAF-3  | `maxAttemptsPerDay` never exceeded (workspace-tz day)                 | `attempt.reserved` per account per day                          |
| SAF-4  | No dispatch to a suppressed account                                   | `account.decided` suppression vs later dispatches same tick-day |
| SAF-5  | Channel rate ≤ per-minute cap in every sliding 60s window             | `dispatch.requested` timestamps per channel                     |
| SAF-6  | At-most-once: one dispatch per reservation; no dispatch without one   | reserved/requested pairing                                      |
| PERF-1 | Tick duration < `tickSeconds`                                         | `tick.started`/`tick.completed`                                 |
| PERF-2 | Dispatch latency p95 ≤ threshold                                      | `dispatch.*` latency                                            |
| PERF-3 | Error rate per channel ≤ threshold                                    | failed / requested                                              |
| PERF-4 | Budget utilization: no eligible account skipped while tokens remained | `budget_exhausted` decisions vs `tick.completed` usage          |
| LIVE-1 | Eligible account attempted within N ticks of eligibility              | `account.decided` history                                       |

`Scorecard`: overall verdict + per-invariant `{ id, scope: "workspace" | "deployment",
verdict, metric?, violations: [{ campaignId?, portfolioAccountId?, eventIds, detail }] }`,
plus a per-campaign breakdown (ticks seen, considered, dispatched, failed, suppressed,
violations) and stream-gap list — every verdict traces invariant → campaign → account →
event ids. Thresholds (`p95LatencyMs`, `maxErrorRate`, `livenessTicks`, …) come in via
`EvaluationParameters` with defaults; rate caps and `tickSeconds` are passed from config
by the caller. SAF-5 and PERF-1 are evaluated from the deployment-level tick events
(aggregate counts), so they hold even when the stream is workspace-filtered.

_Why in common:_ dependency-free and shared — apiserver scripts, tests, and any future
console surface consume the same evaluator.

### 6. Evaluation entry points: CI harness + an npx CLI against the API

- **Tests:** integration tests wire the in-memory sink + emulators + fake clock, run
  scripted scenarios tick-by-tick, and assert the scorecard is green (plus targeted
  red-path assertions: a scripted violation must be caught — the judge is itself tested).
- **Ad hoc against a deployment:** an `engine-eval` bin published with `@qcobro/common`
  (already on npm), run as
  `npx -p @qcobro/common engine-eval --from <iso> --to <iso>`. `--url` defaults to
  `https://api.qcobro.com`; with no `--from`/`--to` it evaluates today's runs (the current
  day in the operator's local timezone); the API-key pair comes from `--access-key-id` /
  `--access-key-secret` (or `QCOBRO_ACCESS_KEY_ID` / `QCOBRO_ACCESS_KEY_SECRET`). It
  fetches events from a new read-only `GET /api/engine/events` endpoint and runs
  `evaluate` **locally**, printing the scorecard to stdout (human summary + `--json`) and
  exiting non-zero on failure. Nothing is stored or scheduled — this is an occasional
  engineering check after engine changes, not a report.
- The endpoint returns the raw event stream plus the engine parameters the deployment is
  running (rate caps, tickSeconds), so the CLI needs no config file; thresholds are flags
  with defaults.

_Why eval client-side instead of a server-side "evaluate" endpoint:_ the judge is pure and
ships in the npm package, so a **newer judge (new invariants) can be pointed at an older
deployed engine** — exactly the iteration loop this tool exists for. The server only ever
exports data. _Why not a repo script:_ requires a checkout and DB credentials; npx needs
only the API URL and a credential.

_Endpoint auth and scoping:_ reuse the existing API-key infrastructure (the `api-keys`
capability — Identity-backed, admin-scoped workspace keys). The CLI presents the
accessKeyId + accessKeySecret pair as Basic credentials; the apiserver validates them
through the same Identity exchange the SDK uses, resolves the key's workspace, and returns
**only that workspace's events** (filtered on `workspaceRef`) plus the deployment-level
tick lifecycle events. Tick events are included so SAF-5 (rate caps) and PERF-1 (tick
duration) remain verifiable from aggregate per-tick counts; the disclosed trade-off is
that an admin key sees deployment-wide aggregate volume numbers, never another
workspace's campaigns, accounts, or provider refs. The scorecard labels each invariant's
scope (`workspace` vs `deployment`) so a scoped evaluation never overstates what it
verified.

The npx flow is documented in the README's "Running the campaigns engine" section,
alongside the existing `engine:sim` emulator instructions — sim to exercise the engine,
`qcobro-eval` to judge a run.

### 7. Retention: pruning keyed to `qcobro.json`

`engine.eventsRetentionDays` (default 30, `0` = keep forever). The runner deletes expired
events opportunistically (at most once per hour, piggybacked on a tick, bounded `deleteMany`).
No new scheduler process.

## Risks / Trade-offs

- [Table growth: hundreds of `account.decided` rows per tick at scale] → batched inserts,
  minimal indexes (tickId, campaignId+at, providerRef, at), retention pruning; if volume
  ever hurts, collapse per-account decisions into one aggregated per-campaign event — the
  judge's input type shields callers from that change.
- [Lost events on mid-tick crash or sink failure] → accepted: best-effort telemetry;
  gestiones + reservations remain authoritative. The judge reports "stream gaps" (a tick
  with `tick.started` but no `tick.completed`) as a distinct signal rather than a violation.
- [False positives in SAF-5 at window edges (bucket refill vs wall-clock minute)] → the
  judge checks the cap with the same per-tick capacity semantics as `buckets.ts`
  (`perTickCapacity`), not a naive 60s window; unit tests pin the boundary cases.
- [Config snapshots bloat `campaign.evaluated`] → snapshot only the fields invariants need
  (schedule, caps, tz, channel), not the whole campaign.
- [PII in events] → recipient identifiers are masked (last 4); message content never enters
  the stream.

## Migration Plan

Additive only: one Prisma migration (`engine_events` + enum), new config key with a
default, sink wired in `start.ts`. No backfill (evaluation begins at deploy). Rollback:
stop emitting (no-op sink); the table can sit idle or be dropped.

## Open Questions

- Default `eventsRetentionDays` — 30 assumed; confirm against expected tick volume.
- LIVE-1's default N (ticks-to-first-attempt) — needs a real-world value once campaigns
  run at volume; ship with a generous default and tighten later.
