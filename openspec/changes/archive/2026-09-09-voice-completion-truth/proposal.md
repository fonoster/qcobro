> **Retroactive change record.** This work already shipped in
> [PR #151](https://github.com/fonoster/qcobro/pull/151) (merged 2026-09-08, commit `9ec6f96`),
> which edited `openspec/specs/**` in place instead of going through
> `/opsx:propose` → `/opsx:apply` → `/opsx:archive` as `CLAUDE.md` requires. The specs on `main`
> already reflect what shipped and are correct; this record exists only to restore the process
> trail, written after the fact from the merged PR and its ten commits. Every task below is
> already done. No behavior changes as a result of this record.

## Why

Every voice failure looked the same in the console. A call that rang out, a busy line, a call
that connected and lost its completion signal, and a call that never happened all finalized as
`Fallido · Error del proveedor` ten minutes after dispatch.

That was not a display bug. `NO_ANSWER` and `BUSY` had been **unreachable in code** since #126
removed the CDR resolver: the timeout sweep was the only path that closed out an unanswered call,
and it always wrote `PROVIDER_ERROR`. The 2026-08-30 incident was the visible symptom — 13 of 16
rows reported Fallido when roughly 8 phones were physically answered.

## What Changed

- **Voice failures are classified from Fonoster's CDR**, not guessed after a fixed timeout. For
  each voice gestión still at `DISPATCHED` past a short floor, the sweep reads the call's detail
  record (`Calls.getCall`) and branches on what is actually there: a terminal status past a grace
  window finalizes with the mapped reason; a terminal status that ended recently is left alone so
  a live completion signal in flight cannot be discarded; no status yet (call still in progress)
  is left alone; no record at all finalizes `NOT_ORIGINATED` once `notOriginatedMinutes` has
  passed; and a record that never gets a status past `backstopMinutes` (default 70, derived from
  the platform's `TIMEOUT(absolute)=3600`) finalizes `OUTCOME_UNKNOWN` rather than polling
  forever. `NO_ANSWER`, `BUSY`, `REJECTED`, `INVALID_DESTINATION`, and `UNREACHABLE` become
  reachable for the first time; `PROVIDER_ERROR` narrows to what it should always have meant.
- **Two new `DeliveryReason` values**: `OUTCOME_UNKNOWN` (the call cleared normally but our own
  completion signal never arrived) and `NOT_ORIGINATED` (no provider record exists at all). Both
  are transient, so the account stays eligible for retry.
- **The completion sweep moved off the campaigns-engine tick** onto its own apiserver-level
  interval with its own lease (`voice-completion-sweep`, distinct from the engine's `engine`
  lease row), independent of `engine.enabled` — manual/ad-hoc voice dispatch needed this
  finalization too, and coverage cannot depend on the engine happening to be running.
- **Breaking: the three contact-log axes renamed from Spanish to English** —
  `entrega` → `delivery`, `camino` → `path`, `resultado` → `outcome`. Enum **values** are
  unchanged (`DISPATCHED`, `ENGAGED`, `PAYMENT_PROMISE`, ...) and the Spanish console labels are
  unchanged — operators still read "Entrega"/"Camino"/"Resultado". Only field names, DB columns,
  Prisma enum types, and the public contact-log endpoint's schema moved.
- **The public contact-log REST endpoint (`POST /api/contact-logs`) became `.strict()`.** A
  caller still posting the pre-rename shape (`entrega`/`camino`/`resultado`) now gets a `400`
  naming the unrecognized keys, instead of a silent `201` that stripped them and wrote a
  `DISPATCHED` row with no outcome. tRPC and the operator console stay on the lenient schema —
  a stray key there is a compile error, not a runtime concern.
- **`VOICE_PRERECORDED` got its own path label**, "Recibido" instead of "Conversación" — that
  channel has no conversation; the value means the script played to the end (or the caller
  pressed a menu option). Voz IA keeps "Conversación"; the threaded channels keep "Respondió".
- **New docs page**, `docs-site/concepts/gestiones.mdx`, documenting every field, every value per
  axis, and the per-channel reachability matrix — the page that served as the spec for the whole
  rename. Wired into the Conceptos nav.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-contact-log`: CDR-based voice completion sweep (replacing the always-`PROVIDER_ERROR`
  timeout sweep), two new `DeliveryReason` values, the sweep's own interval/lease, the
  `delivery`/`path`/`outcome` field rename, and the `.strict()` public REST schema.
- `campaign-triggers`, `email-events-hook`, `portfolio-accounts`, `portfolios`,
  `prerecorded-audio`, `web-console`, `whatsapp-channel`: mechanical `entrega`/`camino`/`resultado`
  → `delivery`/`path`/`outcome` identifier rename in requirement/scenario text, no behavior
  change. `web-console` additionally documents the `VOICE_PRERECORDED` "Recibido" path label and
  the strict-schema rejection scenario on the list/detail requirements.

## Impact

- **Affected specs**: `account-contact-log`, `campaign-triggers`, `email-events-hook`,
  `portfolio-accounts`, `portfolios`, `prerecorded-audio`, `web-console`, `whatsapp-channel` — the
  exact eight files PR #151 touched.
- **Affected code**: `mods/apiserver/src/services/fonosterOutboundCallClient.ts`
  (`mapVoiceCallStatusToDeliveryReason`, `parseEndedAt`), the voice completion sweep and its new
  `startVoiceCompletionSweep` entry point, `createEngineLease` (parameterized lease row id),
  `mods/common/src/schemas` (the axes rename, `createContactLogSchemaStrict`), every apiserver
  read/write site touching `entrega`/`camino`/`resultado`, the webapp's `contactAxes.ts` and
  `i18n.tsx` (`gestiones.path.prerecorded.ENGAGED` → "Recibido"), and
  `docs-site/concepts/gestiones.mdx` (new).
- **Migrations**: hand-written (`ALTER TABLE ... RENAME COLUMN`, `ALTER TYPE ... RENAME TO`,
  `ALTER TYPE ... ADD VALUE`) rather than `prisma migrate dev` output, to avoid a
  drop-and-recreate that would have destroyed every existing gestión's axes. Verified by applying
  all 28 migrations to a throwaway Postgres and diffing against `schema.prisma`: zero drift.
- **Upstream**: six issues filed against Fonoster while investigating —
  fonoster/fonoster#881, #882, #883, #884, #885, and fonoster/routr#364. #883
  (`Calls.TrackCall` never delivers events for API-originated calls) is the one that would let
  this mapping move from a sweep interval to real time.
- **Discrepancy found while reconciling this record** (reported, not fixed here — see the PR
  description for this change): `openspec/specs/web-console/spec.md`'s "Channel-aware Detalle de
  gestión" requirement still gives `Entregado → Conversación` as the rendered `Camino` value for a
  `VOICE_PRERECORDED` gestión with `path: ENGAGED`. The shipped code
  (`mods/webapp/src/lib/contactAxes.ts`, `pathWord`/`pathProgression`) renders that case as
  `Despachado → Recibido`: the progression always starts from `gestiones.delivery.DISPATCHED`
  ("Despachado"), never from the delivery word, and `VOICE_PRERECORDED`'s `ENGAGED` path renders
  through `gestiones.path.prerecorded.ENGAGED` ("Recibido") since PR #151's third commit, not
  the generic `gestiones.path.ENGAGED` ("Conversación") that requirement's example still shows.
  This mismatch predates PR #151 for the `Despachado`/`Entregado` half (the example was already
  wrong about the prefix before this PR) and was introduced for the `Recibido`/`Conversación`
  half by this PR's own webapp commit, which updated the code and the adjacent
  `prerecorded-audio`/`account-contact-log` prose but not this specific web-console example.
