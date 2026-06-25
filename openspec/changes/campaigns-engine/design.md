## Context

The lower layers already exist: the campaign data model (schedule fields, triggers,
`CampaignAccountState`), the `dispatchOutreach` trigger (a pure, DB-free,
provider-injected function explicitly built so "the same function backs both the manual
flow and the campaigns engine"), and the reactive outcome path (`createContactLog` +
voice-events webhook + `POST /api/contact-logs`). What is missing is the autonomous
driver. Constraints from the product owner: keep it simple (apiserver-only, no separate
worker, avoid Redis unless forced), but leave clean seams to grow; low demand initially;
pacing is per-channel; everything must be simulatable in tests with the channel as the
only faked part.

## Goals / Non-Goals

**Goals:**

- An in-apiserver engine that, on a timer, originates outreach for in-window `ACTIVE`
  campaigns through the existing `dispatchOutreach` trigger.
- **At-most-once** per `(campaignId, portfolioAccountId)` — never double-dial a debtor.
- Per-channel pacing; timezone-correct scheduling windows; deterministic, testable logic.
- One gestión per attempt; manual and engine share one accounting path.
- A simulation/testing contract good enough to prove at-most-once under a crash.

**Non-Goals (deferred, documented):** contact identity / person-level suppression +
global contact history (`docs/design-notes/contact-identity.md`); multi-touch
sequences; `EMAIL`/`WHATSAPP` dispatchers; window-spreading pacing; voice
true-concurrency cap; bounded-parallel dispatch; cross-campaign per-person frequency cap;
config-selectable sandbox emulator; a dedicated `PENDING`/`SENT` outcome value; an
operator "why didn't X get called?" UI.

## Decisions

### Runtime: in-process timer, Postgres as the only coordinator

`setInterval`-style timer inside the apiserver calling one `tick()`. Single-flight guard
(skip if a tick is running) + one Postgres advisory lock (insurance against a second
instance). **Alternatives considered:** a separate worker container (more infra than
warranted at low demand); pg-boss/BullMQ (real queue, but Redis or extra machinery we
don't need yet). The `tick()` boundary is the seam — it can later be invoked by a queue,
cron, or worker with no change to the reserve/dispatch/record core.

### At-most-once via row-level reserve-before-send

The real guarantee is the row, not the timer: a reserve transaction does
`SELECT … FOR UPDATE` on the `CampaignAccountState` row for `(campaignId, accountId)`,
re-validates eligibility, increments counters, commits — and only then calls the provider
**outside** the transaction. **Why:** the manual flow and webhooks run concurrently with
the engine, so correctness must live at the row, not in a global lock. A crash between
commit and dispatch yields a _missed_ attempt (acceptable), never a double-dial. We never
compensate/decrement, because an ambiguous timeout (call may have gone out) must be
treated as sent. **Alternative considered:** idempotency keys + retq ueue — heavier, and
still needs the reserve to be safe.

### Per-channel pacing via in-memory token buckets

One token bucket per channel, rate configured deployment-wide in `qcobro.json` (the
provider pools are deployment-wide, so pacing is global per channel). Bucket capacity =
the per-minute rate, so the window-open "burst" is at most one minute's budget — no
thundering herd. **Why in-memory:** one engine instance is authoritative; a restart just
resets the bucket (harmless at low demand). The `tryTake()` interface is the seam for a
Postgres/Redis-backed bucket if we ever run multiple instances. Voice rate is used as a
crude concurrency proxy for v1; a true concurrency cap (counting in-flight calls via the
call-ended webhook) is deferred.

### Scheduling window consumes the deployment timezone

The engine is the first consumer of `qcobro.json` `timezone`. `isInWindow(campaign, now,
tz)` is a pure function over an **injected clock**, so windows are deterministic in tests
(simulate any instant). ISO weekdays (1=Mon..7=Sun, matching the existing data). No
overnight windows in v1 (`startTime < endTime`). The daily cap is derived from the local
date of `lastAttemptAt` — no midnight reset job, DST-correct.

### Split `createContactLog` into `reserveAttempt` + `recordOutcome`

`createContactLog` today couples counter-increment with the gestión write, which fights
reserve-before-send. Split: `reserveAttempt` (counters, pre-send) and `recordOutcome`
(gestión upsert by provider ref + triggers, post-outcome, no recount). One gestión per
attempt, correlated by provider ref; the async callback enriches it; never downgrade a
real outcome to the dispatch-time placeholder; guard `Objective` creation so re-delivered
webhooks are idempotent. Manual outreach uses the same two functions (counted + logged),
as an operator override on soft caps.

### Lifecycle: keep the guarded status map; auto-complete on `endDate` only

The existing `campaignStatusTransitions` map stays (no XState — a 4-state persisted enum
doesn't justify the dependency; if anything ever needs it, it's a per-call lifecycle we
deliberately avoid holding in-process). The engine adds one automation: flip
`ACTIVE → COMPLETED` when `endDate` passes (Option A). Open-ended campaigns run until an
operator acts. Completion is lazy housekeeping — the window gate already blocks dispatch
past `endDate`.

### Failure handling: two tiers, no retry machinery

Readiness failures (channel not configured/synced, empty pool, unsupported channel) are
caught once per campaign per tick → skip the whole campaign, burn zero attempts. Per-call
failures consume the attempt (at-most-once), are not retried in-cycle, and write no
gestión. There is no retry queue — the next scheduled attempt under the caps _is_ the
retry. All failures surface in the `TickReport` + logs.

### Simulation via channel emulators (test-support only)

The provider clients are already injected. **Channel emulators** (canonical term) are
test doubles that record would-be dispatches and return deterministic refs. Simulation =
the real engine + real DB writes + emulators; only the channel is faked. Two test levels:
unit (fake `CampaignClient` + emulators, assert the `TickReport`) and integration (real
Postgres + emulators, simulate a crash between reserve-commit and dispatch, assert exactly
one dispatch per `(campaign, account)`). Emulators are never wired into production config.

## Risks / Trade-offs

- **In-memory bucket resets on restart** → a small burst possible; bounded by capacity =
  per-minute rate, harmless at low demand. Move behind a durable `tryTake()` if we scale out.
- **Voice rate as a concurrency proxy** → could overshoot the pool on long calls; the pool
  itself rejects excess (structured per-call errors), so degraded not catastrophic.
- **Transient provider error burns an attempt** → at-most-once accepts the occasional
  wasted attempt; readiness failures (the common, systemic case) are caught up-front and
  burn nothing.
- **Long tick starving the event loop** → bounded work per tick + sequential dispatch
  (I/O-bound, yields between awaits); bounded-parallel is a later throughput lever.
- **Engine accidentally dialing in dev** → `engine.enabled` defaults off in dev configs;
  emulators are test-only, not a dev runtime.

## Migration Plan

1. Add `engine` + per-channel pacing config to `qcobroConfigSchema` (defaults: engine off).
2. Store the provider ref on the gestión; guard duplicate `Objective` creation (no new tables).
3. Split `createContactLog` → `reserveAttempt` + `recordOutcome`; point manual outreach at them.
4. Build the engine module (`tick()`, window gate, funnel, reserve, pacing, failures,
   completion, `TickReport`) + emulators; start on boot when `engine.enabled`.
5. Roll out with `engine.enabled = false`, verify via simulation, then enable in prod.
   Rollback = set `engine.enabled = false` (manual outreach unaffected).

## Open Questions

- Default `tickSeconds` and the per-tick dispatch cap `K` (start ~60s / a small K; tune
  with real pacing during implementation).
- Channel-budget fairness across campaigns sharing a channel when budget is tight
  (parked: strict order vs round-robin — rarely binds at low demand).
- Initial dispatch-time outcome value: reuse `OTHER` (current convention) for v1, or add
  `PENDING`/`SENT` (parked refinement).
