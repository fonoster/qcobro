## Why

Campaigns carry scheduling (`daysOfWeek`, `startTime`/`endTime`, `startDate`/`endDate`),
attempt caps, and triggers — but **nothing consumes them**. Communication is only ever
originated when a human clicks "Contactar" (the manual `outreach.dispatch` flow). The
deployment-wide `timezone` in `qcobro.json` is declared but unused. There is no
autonomous engine: the piece every campaign assumes exists. `dispatchOutreach` was
deliberately built as a pure, DB-free, provider-injected trigger "so the same function
backs both the manual flow and the campaigns engine" — this change builds that engine.

## What Changes

- A new **campaigns engine**: an in-process timer in the apiserver that, each tick,
  finds `ACTIVE` campaigns currently inside their schedule window, selects eligible
  accounts, and originates outreach through the existing `dispatchOutreach` trigger —
  respecting per-channel pacing and per-account caps.
- **At-most-once dispatch** per `(campaign, account)` via a row-level reserve-before-send
  transaction (never double-dial a debtor; an occasional missed attempt is acceptable).
- **Per-channel pacing** via deployment-wide token buckets (units/min) configured in
  `qcobro.json`. The engine dispatches the channels `dispatchOutreach` supports today
  (`VOICE_AI`, `VOICE_PRERECORDED`, `SMS`); `EMAIL`/`WHATSAPP` campaigns surface a
  readiness failure until dispatchers exist.
- The engine becomes the **first consumer of the deployment `timezone`** (window math).
- **Automatic lifecycle completion**: the engine flips `ACTIVE → COMPLETED` when a
  campaign's `endDate` has passed (open-ended campaigns run until paused/completed).
- **One gestión per attempt**, correlated by provider ref and enriched by the async
  outcome callback (no duplicate contact logs). `createContactLog` splits into
  `reserveAttempt` (pre-send counter) + `recordOutcome` (post-outcome upsert + triggers).
- **BREAKING (data semantics):** the `MAX_ATTEMPTS_PER_DAY` trigger type is retired —
  the `Campaign.maxAttemptsPerDay`/`maxAttemptsPerAccount` fields are canonical.
- A new **`engine` config block** (`enabled`, `tickSeconds`) — off in dev, on in prod.
- A **`TickReport`** returned by each tick (logged in prod, asserted in tests) that
  explains every per-account decision (dispatched / suppressed / capped / out-of-window).
- **Channel emulators** (test-support only) so the whole engine — including DB writes —
  can be simulated and validated, with the channel itself the only thing faked.

## Capabilities

### New Capabilities

- `campaigns-engine`: the autonomous tick loop that originates campaign outreach —
  runtime model (timer, single-flight, advisory lock, bounded work), at-most-once
  reserve-before-send, per-channel token-bucket pacing, the schedule-window gate
  (timezone-aware), the account-eligibility funnel with decision reasons, two-tier
  failure handling, automatic `endDate` completion, the `TickReport`, and the
  emulator-based simulation/testing contract.

### Modified Capabilities

- `campaign-triggers`: retire the redundant `MAX_ATTEMPTS_PER_DAY` trigger type (the
  campaign fields are canonical); make concrete that the engine evaluates static triggers
  before each dispatch and AI triggers on outcome write.
- `account-contact-log`: one gestión per attempt, correlated by provider ref; split the
  attempt-counter increment (reserve, pre-send) from the gestión write (record, on
  outcome); re-delivered provider webhooks are idempotent and never downgrade a real
  outcome back to the dispatch-time placeholder.

## Impact

- **apiserver**: new engine module (timer + `tick()`), started on boot when
  `engine.enabled`; refactor of `createContactLog` into `reserveAttempt` + `recordOutcome`;
  manual `outreach.dispatch` routes through the shared accounting.
- **@qcobro/common**: `engine` + per-channel pacing config in `qcobroConfigSchema`;
  `TickReport` types; emulator/clock injection interfaces.
- **DB (Prisma)**: store the provider ref on the gestión for correlation; guard against
  duplicate `Objective` creation. No new tables for v1.
- **channel-dispatch**: consumed unchanged (the engine is its second caller); test-double
  wording aligns to "emulator."
- **Deferred / out of scope** (documented, not built): contact identity / person-level
  suppression + global contact history (`docs/design-notes/contact-identity.md`),
  multi-touch sequences, `EMAIL`/`WHATSAPP` dispatchers, window-spreading pacing, voice
  true-concurrency cap, bounded-parallel dispatch, cross-campaign per-person frequency
  cap, config-selectable sandbox emulator, `PENDING`/`SENT` outcome value, operator
  "why didn't X get called?" UI.
