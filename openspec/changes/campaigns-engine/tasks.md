## 1. Config & contracts (@qcobro/common)

- [x] 1.1 Add an `engine` block to `qcobroConfigSchema`: `{ enabled: boolean (default false), tickSeconds: number (default 60) }`; document it in `qcobro.example.json`
- [x] 1.2 Add per-channel pacing to the `fonoster`/`twilio` config blocks (e.g. `maxCallsPerMinute`, `maxSmsPerMinute`) with safe defaults; document in `qcobro.example.json`
- [x] 1.3 Define `TickReport` types (per-campaign + per-account decision with reason + per-channel budget usage) and the decision-reason enum
- [x] 1.4 Define injection interfaces the engine needs: an injectable `clock` (now()) and the channel-emulator-compatible provider client interfaces (reuse existing `OutboundCallClient`/`SmsClient`)
- [x] 1.5 Rebuild `@qcobro/common` (`tsc -b`) so apiserver picks up the new types

## 2. Data model (Prisma)

- [x] 2.1 Ensure the gestión stores the provider ref for correlation (in `channelData` or a dedicated indexed column); add an index supporting lookup-by-provider-ref
- [x] 2.2 Add a uniqueness guard so one gestión yields at most one `Objective` (unique on `contactLogId` or equivalent)
- [x] 2.3 Generate + write the migration; run `db:generate`

## 3. Contact-log accounting refactor

- [x] 3.1 Split `createContactLog` into `reserveAttempt(campaignId, accountId)` (counter increments + `PortfolioAccount` hot-path, transactional) and `recordOutcome({ providerRef, … })` (upsert gestión by provider ref + apply triggers, no recount)
- [x] 3.2 Make `recordOutcome` idempotent: upsert by provider ref, never downgrade a real outcome to the placeholder, guard duplicate `Objective` creation, create-if-absent when the callback precedes the dispatch entry
- [~] 3.3 Point the voice-events webhook and `POST /api/contact-logs` at `recordOutcome` — DEFERRED (needs outcome-flow + first-class providerRef in payload; tracked as follow-up)
- [x] 3.4 Rewire manual `outreach.dispatch` to `reserveAttempt` → dispatch → `recordOutcome` (operator override on soft caps; still counted + logged)
- [x] 3.5 Update/extend unit tests for the split (counters increment once at reserve; re-delivered webhook is idempotent; no downgrade)

## 4. Channel emulators (test-support only)

- [x] 4.1 Implement `EmulatedOutboundCallClient` and `EmulatedSmsClient` that record would-be dispatches and return deterministic provider refs (in a test-support module, never imported by production code)
- [x] 4.2 Optionally support emulating provider failure (to exercise the per-call failure path)

## 5. Engine core

- [x] 5.1 `isInWindow(campaign, now, tz)` pure function (status + dates + ISO `daysOfWeek` + `startTime`..`endTime` in deployment tz; no overnight) over the injected clock
- [ ] 5.2 Candidate query: accounts in the campaign's portfolios with a phone (workspace-spanning across all tenants)
- [x] 5.3 Eligibility funnel with decision reasons: global intent/`suppressUntil`, campaign-local `suppressUntil`, `maxAttemptsPerAccount`, `maxAttemptsPerDay` (daily count derived from `lastAttemptAt` local date), fairness ordering (`lastAttemptAt` asc, stable tiebreaker)
- [x] 5.4 Per-channel token buckets with a `tryTake()` interface; map a campaign's channel from its agent-template type; voice + SMS only
- [ ] 5.5 `reserveAndDispatch(campaign, account)`: row-lock reserve txn (re-validate + increment) → commit → `dispatchOutreach` outside the txn → `recordOutcome(providerRef, placeholder)`
- [ ] 5.6 `tick()`: iterate ACTIVE campaigns, gate window, run readiness check, select + dispatch within per-channel budget and the per-tick cap `K`, accumulate the `TickReport`

## 6. Failure handling & lifecycle

- [ ] 6.1 Readiness check per campaign per tick (channel configured/synced, non-empty pool, supported channel) → skip whole campaign, zero attempts, reason in report
- [ ] 6.2 Per-call failure path: attempt stays consumed, no retry, no gestión, reason in report
- [ ] 6.3 Auto-complete: flip `ACTIVE → COMPLETED` when `endDate` has passed (local tz) via the existing guarded transition; open-ended campaigns untouched

## 7. Engine wiring

- [ ] 7.1 Engine module with single-flight guard + a Postgres advisory lock around each tick
- [ ] 7.2 Start the timer on apiserver boot only when `engine.enabled`; emit the `TickReport` as a structured log each tick
- [ ] 7.3 Graceful shutdown: stop scheduling, start no new reservations, let the in-flight dispatch settle

## 8. Tests

- [ ] 8.1 Unit: window gate (incl. DST/weekday/edges), eligibility funnel reasons, pacing budget, completion — fake `CampaignClient` + emulators, assert the `TickReport`
- [ ] 8.2 Integration: real Postgres + emulators — **simulate a crash between reserve-commit and dispatch, re-run the tick, assert exactly one dispatch per `(campaign, account)`**
- [ ] 8.3 Integration: concurrent manual + engine for the same `(campaign, account)` cannot double-reserve
- [ ] 8.4 Run lint + typecheck + the apiserver/common test suites green

## 9. Spec sync & cleanup

- [ ] 9.1 Make the engine ignore any legacy `MAX_ATTEMPTS_PER_DAY` trigger rows (campaign fields canonical); note removal in release notes
- [ ] 9.2 Align the `channel-dispatch` test-double wording ("stubs" → "emulators")
- [ ] 9.3 `openspec validate campaigns-engine` clean; verify `qcobro.example.json` documents the new config
