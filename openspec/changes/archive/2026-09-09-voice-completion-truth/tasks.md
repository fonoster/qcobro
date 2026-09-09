> Retroactive record — see `proposal.md`. All tasks below were already done as of PR #151's merge
> (`9ec6f96`, 2026-09-08). Each is traceable to one of the PR's ten commits.

## 1. Rename the contact-log axes to English

- [x] 1.1 Renamed `entrega`/`camino`/`resultado` to `delivery`/`path`/`outcome` across the Prisma
      enum types and column names (`Entrega` → `Delivery`, `Camino` → `Path`, `Resultado` →
      `Outcome`), the Zod schemas and TS types in `@qcobro/common`, every apiserver read/write
      site, and the webapp (`contactAxes.ts` helpers, i18n keys, `ResultadoRow` → `OutcomeRow`)
      (commit `9b940c1`, `refactor(contact-log): rename entrega/camino/resultado axes to
    English`)
- [x] 1.2 Hand-wrote the Prisma migration (`ALTER TABLE ... RENAME COLUMN`,
      `ALTER TYPE ... RENAME TO`, plus index renames) instead of letting `prisma migrate dev`
      generate a drop-and-recreate, which would have destroyed every existing gestión's axes;
      verified by applying all 28 migrations to a throwaway Postgres and diffing against
      `schema.prisma` — zero drift (commit `9b940c1`)
- [x] 1.3 Enum **values** left unchanged (`DISPATCHED`, `ENGAGED`, `PAYMENT_PROMISE`, ...); the
      console's Spanish i18n VALUES left unchanged ("Entrega"/"Camino"/"Resultado") — only
      field/type/key names moved (commit `9b940c1`)
- [x] 1.4 Updated the affected openspec specs and the contact-log API doc in the same commit
      (commit `9b940c1`)
- [x] 1.5 Fixed e2e specs that seeded gestiones with the pre-rename field names, which would have
      400'd against the live contact-log endpoint once the rename and the later strict-schema
      commit landed (commit `fb3ad82`)

## 2. Classify voice completion failures from Fonoster's CDR

- [x] 2.1 Replaced `voiceCompletionTimeoutSweep`'s always-`FAILED`/`PROVIDER_ERROR` finalization
      with classification from Fonoster's call detail record (`Calls.getCall`)
      (`mapVoiceCallStatusToDeliveryReason`, new pure function + unit tests) (commit `fb3ad82`)
- [x] 2.2 A CDR with no status yet (call still in progress) is left alone, not treated as a
      failure, for a later sweep pass to decide (commit `fb3ad82`)
- [x] 2.3 No CDR at all (Fonoster `NOT_FOUND`, surfaced as a typed `{ found: false }` result
      rather than a thrown error) finalizes `FAILED`/`NOT_ORIGINATED` (commit `fb3ad82`)
- [x] 2.4 A gestión whose CDR carries no status past the backstop is finalized
      `FAILED`/`OUTCOME_UNKNOWN` rather than polled forever (commit `fb3ad82`)
- [x] 2.5 Added the two new `DeliveryReason` values (`OUTCOME_UNKNOWN`, `NOT_ORIGINATED`) via a
      purely additive `ALTER TYPE ... ADD VALUE` migration — no backfill, safe without downtime
      (commit `fb3ad82`)
- [x] 2.6 Confirmed the CDR's own duration (which includes ring time) is never written into a
      gestión's `durationSeconds`, and that existing idempotence (delivery only advances, a no-op
      finalize touches neither `durationSeconds` nor `channelData`) still holds (commit `fb3ad82`)
- [x] 2.7 Moved the sweep off the campaign-engine tick onto its own apiserver-level interval
      (`startVoiceCompletionSweep`), independent of `engine.enabled`, with thresholds (2min
      floor, 30min backstop at the time, interval) configurable under a new
      `voiceCompletionSweep` config section (commit `fb3ad82`)

## 3. Give VOICE_PRERECORDED its own path label

- [x] 3.1 `pathWord` in `contactAxes.ts` special-cases `VOICE_PRERECORDED`'s `ENGAGED` path the
      same way it already special-cased the threaded channels, reading "Recibido" ("Got the
      message") instead of "Conversación" — that channel has no conversation, the value means
      the script played to the end or the caller pressed a menu option. `VOICE_AI` is unaffected
      and keeps "Conversación" (commit `1a5251a`)
- [x] 3.2 Fixed the one e2e assertion that expected the old, misleading "Conversación" label on
      that channel (commit `1a5251a`)

## 4. Fix stale references the rename missed

- [x] 4.1 Reworded `agentEvaluations.ts`'s strict-schema comment, which the blanket rename had
      turned into a nonsensical "outcome -> outcome" self-reference, to describe the actual
      historical `resultado` → `outcome` rename; disambiguated `contactLog.ts`'s top comment from
      an unrelated era that coincidentally also used `outcome` (commit `b12327f`)
- [x] 4.2 Updated `docs-site/sdk/agent-evaluations.mdx`'s eval-suite code examples (TS, YAML, and
      the `ParamField`) from `resultado` to `outcome`, since the schema's `.strict()` now rejects
      the old key outright (commit `b12327f`)

## 5. Give a live completion signal a grace period before the sweep finalizes

- [x] 5.1 Identified the race: Routr's call-end event reaches the CDR a couple seconds before
      Fonoster's autopilot posts `conversation.ended` to our webhook; a sweep pass landing in
      that window would win the DB-guarded write and permanently discard a real answered outcome
      as `FAILED`/`OUTCOME_UNKNOWN` (commit `8c80a66`)
- [x] 5.2 Added `endedAt` to `VoiceCallLookupResult`, sourced from the CDR's own end time and
      treated as unset (not trusted) whenever it isn't a real positive instant — an in-progress
      call's unset protobuf timestamp deserializes to the epoch, not `undefined` (commit
      `8c80a66`)
- [x] 5.3 Added `graceSeconds` config (default 60); `classify()` only returns a terminal reason
      once the CDR has been ended for at least that long, otherwise returns null and leaves the
      gestión at `DISPATCHED`, identically to the in-progress branch. `NOT_FOUND` and the backstop
      are unaffected — neither races a live signal (commit `8c80a66`)

## 6. Parse the CDR's real wire shape for endedAt

- [x] 6.1 Found that `parseEndedAt` only accepted a `Date`, matching `@fonoster/types`' declared
      (but wrong-for-the-wire) type, while the proto field is `int32 ended_at` — epoch seconds —
      which nothing in the SDK converts; the original parser would have returned null for every
      real terminal CDR, silently collapsing classification to `NOT_ORIGINATED`/`OUTCOME_UNKNOWN`
      only (commit `5e1fdee`)
- [x] 6.2 `parseEndedAt` now accepts a `Date`, a number (disambiguating epoch seconds from
      milliseconds by magnitude), or a numeric string; exported and unit-tested against all three
      plus the values it must still reject (0, negative, NaN, unparseable) (commit `5e1fdee`)
- [x] 6.3 A terminal CDR whose `endedAt` still can't be parsed logs a one-time warning
      (`typeof` + raw value) instead of degrading silently (commit `5e1fdee`)
- [x] 6.4 Added a sweep test driving the terminal-status/grace branch with a realistic
      epoch-seconds value through the real `parseEndedAt`, so this composition is covered end to
      end (commit `5e1fdee`)

## 7. Stop the sweep from stalling on an unparseable CDR end time

- [x] 7.1 Fixed `classify()` returning null unconditionally for a terminal CDR with an unusable
      `endedAt`, which skipped the backstop check entirely and left such a gestión re-polled
      forever; it now falls through to the backstop and finalizes with the CDR's mapped reason,
      not the generic `OUTCOME_UNKNOWN` (commit `3a79748`)
- [x] 7.2 Fixed `fonosterOutboundCallClient.ts`'s warning log, which claimed this case fell
      through to `NOT_ORIGINATED` (commit `3a79748`)
- [x] 7.3 Raised `backstopMinutes`'s default from 30 to 70 — the platform's dialplan sets
      `TIMEOUT(absolute)=3600`, so no channel survives past 60 minutes; past that plus a margin,
      an uncleared CDR has genuinely lost its end record (commit `3a79748`)
- [x] 7.4 Added `notOriginatedMinutes` (default 5), a separate age gate for the `NOT_FOUND`
      branch from `floorMinutes` — that write is irreversible and the CDR's start record can lag
      dispatch (commit `3a79748`)
- [x] 7.5 Extended the `account-contact-log` spec to match the corrected fallback behavior, the
      raised backstop with its rationale, and the new `notOriginatedMinutes` gate (commit
      `3a79748`)

## 8. Guard the sweep with its own lease

- [x] 8.1 Identified that moving the sweep off the engine's tick lost its single-leader guard —
      the engine ran it after acquiring the shared lease, so exactly one instance ever swept;
      `startVoiceCompletionSweep`'s bare `setInterval` only guards in-process re-entry, so a
      multi-replica deployment would run every replica's full pass concurrently (commit
      `c87bcfa`)
- [x] 8.2 Parameterized `createEngineLease`'s lease row id (default `"engine"`, unchanged for
      existing callers) so the sweep claims a distinct `"voice-completion-sweep"` row instead of
      contending with the campaigns engine's lease; the sweep's own `acquire()` both claims and
      renews each pass, sized generously above the sweep interval (commit `c87bcfa`)
- [x] 8.3 Verified against a real Postgres: all 5 lease integration tests pass unchanged with the
      parameterized id (commit `c87bcfa`)
- [x] 8.4 Confirmed `settleVoiceUsageTx` is idempotent per `providerRef` (checks
      `record.settledAt`; a `(usageRecordId, kind)` unique constraint guards a racing
      double-insert), so repeated/concurrent calls from multiple replicas can't double-charge or
      double-adjust (commit `c87bcfa`)

## 9. Reject unrecognized keys on the public contact-log endpoint

- [x] 9.1 Added `createContactLogSchemaStrict` (`createContactLogFields.strict()`, same
      `refineContactLogAxes` validation) alongside the existing lenient schema;
      `createCreateContactLog` takes an `opts.strict` flag, and only the REST handler passes it —
      tRPC/operator-console callers stay on the lenient schema, since a stray key there is a
      compile error already (commit `4a7989e`)
- [x] 9.2 No alias added for the pre-rename field names: the docs already carried the
      breaking-change notice, and an alias would have kept the old shape alive indefinitely
      (commit `4a7989e`)

## 10. Ship the gestión anatomy docs page

- [x] 10.1 Tracked `docs-site/concepts/gestiones.mdx` — `docs-site/docs.json` already referenced
      it in the Conceptos nav, but the page itself was untracked, so a build from the branch
      would have shipped a nav entry pointing at nothing (commit `c47daa2`)
- [x] 10.2 Documented the three axes, the delivery-reason table (including `OUTCOME_UNKNOWN` and
      `NOT_ORIGINATED`), the path/outcome emission table, and the per-channel reachability
      matrix — this page served as the spec for the whole rename while it was being made (commit
      `c47daa2`)

## 11. Testing (done pre-merge, per the PR description)

- [x] 11.1 529 apiserver tests, 221 common tests, lint and builds clean
- [x] 11.2 Coverage includes every sweep branch, the grace window, the backstop, `parseEndedAt`
      against each wire shape it can arrive as, and a rejected old-shape REST payload
- [ ] 11.3 Live call against staging — the PR description flagged this as **not yet done** at
      merge time ("Two of the three defects above came from reasoning about what Fonoster puts on
      the wire rather than observing it... Worth doing before this reaches production."); this
      retroactive record does not confirm whether it happened after merge

## 12. Spec reconciliation & archive (this retroactive record)

- [x] 12.1 Confirmed the delta specs in this change match `openspec/specs/**` on `main` exactly —
      no new design, pure reconciliation
- [x] 12.2 Found and reported one genuine discrepancy between the shipped code and the shipped
      main spec (the `web-console` `Camino` example for `VOICE_PRERECORDED`) rather than papering
      over it — see `proposal.md`
- [x] 12.3 `openspec validate voice-completion-truth --strict` passes
- [x] 12.4 Archived the change
