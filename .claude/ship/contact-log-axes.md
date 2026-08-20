# Ship checkpoint — contact-log-axes

Started: 2026-08-19
Current stage: 4 done (build + tests green, code review applied) — next: stage 5 (sync gate)

**Scope:** Split the overloaded `ContactOutcome` enum into three orthogonal axes on the
account contact log — **`entrega`** (did it reach the device/inbox: `DISPATCHED` /
`DELIVERED` / `FAILED`, plus a `deliveryReason` on failure), **`camino`** (what path the
interaction took: `ENGAGED` / `ABANDONED` / `VOICEMAIL`, nullable), and **`resultado`**
(what came of the engagement: `PAYMENT_PROMISE`, `PAID`, `WRONG_PARTY`, … — nullable, and
structurally impossible on SMS and Pre-grabada). Retires `OTHER` and `WRONG_NUMBER`. Makes
the delivery/engagement/conversion funnel computable for the first time.

**Detected surfaces:** OpenSpec: yes (CLI 1.4.1) · Pencil: yes (`pencil.pen`) · Storybook: yes (`mods/webapp/.storybook`) · E2E: yes (Playwright, root `playwright.config.ts`)

**Branch / worktree:** `feat/contact-log-axes` @ `.claude/worktrees/feat+contact-log-axes`, based on `origin/main` (92bee8b).

| #   | Stage           | Status  | Notes                                                                                                                    |
| :-- | :-------------- | :------ | :----------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change authored from a long design discussion; no pre-existing OpenSpec change. Surfaces detected above.                 |
| 1   | Design (Pencil) | done    | 5 detail blocks + Gestiones list edited. **Approved by user 2026-08-19.**                                                |
| 2   | Spec reconcile  | done    | Deltas for `account-contact-log`, `web-console`, `prerecorded-audio`, `portfolios`. `openspec validate --strict` passes. |
| 3   | Build           | done    | 59 files changed + 8 new. Migration rehearsed on a scratch Postgres; caught a one-way-channel back-fill defect.          |
| 4   | Test            | done    | 362 apiserver + 179 common pass, 0 type errors, lint clean. Playwright spec added. `/code-review high` applied.          |
| 5   | Sync            | pending | Gate.                                                                                                                    |
| 6   | Archive         | pending | Gate.                                                                                                                    |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## ⚠ Pencil file location

The design edits were made in the **main checkout's** file
`/Users/psanders/Projects/qcobro/pencil.pen` — that is the one the user has open in the
Pencil app, so iteration has to happen there to be visible. This worktree's copy is still
the committed version. **Before committing stage 3, copy the main checkout's `pencil.pen`
into this worktree.** If the design is iterated further, re-copy.

## Design decisions (Stage 1)

- **Two separate metadata fields, not one composed path.** User chose a flat `Entrega`
  (Despachado | Entregado | Fallido) plus a `Camino` shown as an arrow path
  (`Despachado → Conversación`). A single composed field was proposed and declined.
- **`deliveryReason` renders inline** after a middot: `Fallido · Sin respuesta`. No
  dedicated row, no extra layout.
- **`Resultado` stays its own body-level row**, and is **dropped entirely from SMS and
  Pre-grabada** — those channels have no inbound ingest (`functions/sms/` has only
  `recordSmsDeliveryStatus`; there is no `ingestSms*`), so `resultado` is structurally
  always null. Render rule is "show when non-null", which needs no channel table and
  degrades correctly if SMS ever becomes two-way.
- **`Camino` is omitted on SMS and Pre-grabada** for the same reason.
- **`Leído` survives as a display-only stage** inside the Email/WhatsApp camino path,
  sourced from `channelData.openedAt`. It is NOT a `camino` enum value — read-but-unengaged
  was deliberately left unmodeled, so read rate stays uncomputable. Disclosed to the user.
- **Email's `Resultado` row moved out of the AI-insights section** to body level, matching
  Voz IA and WhatsApp. This fixes a live build bug (see below).
- **List columns:** `CLIENTE · CANAL · ENTREGA · RESULTADO · FECHA` — "RESUMEN IA" dropped
  (it is null until an insight is generated, and was the widest column). Resultado renders
  `—` when null, which is the common case; that sparseness is what makes conversion legible.
- **Toolbar filter split** into `Todas las entregas` + `Todos los resultados` alongside the
  existing channel filter. The single mixed outcome filter is the conflation being undone.
- Fixed a pre-existing 4px overflow: SMS `bubble` was 520px inside a 516px content box.

## Code review (stage 4) — 10 findings, 8 fixed here

`/code-review high` over the full working tree. Fixed in this change:

1. **`whatsAppWebhook.ts` wrote a removed enum value.** The Meta-131050 handler still set
   `intentStatus: "OPT_OUT"`, which the migration deletes — it would have thrown at runtime,
   losing the opt-out _and_ aborting the inbound-message loop in the same `try`. It escaped
   `tsc` because the local `WebhookDb` typed the field as bare `string`; the interface is now
   typed against the `Resultado` enum so the same class of bug cannot recur.
   2 & 9. **`recordOutcome` nulled every column a previous signal had recorded.** `logData`
   rebuilds all columns from the input, and the enrich branch only merged five of them
   forward. Since enrichment arrives piecemeal (dispatch → webhook → AI pass), whichever
   landed last erased the rest — a Voz IA outcome decision wiped the `durationSeconds`
   `ingestVoiceEvent` had just stored, and raced the insight generator for the `ai*` columns.
   Now every nullable enrichment field merges forward. Regression test added.
2. **Duplicate gestión per inbound WhatsApp message.** `recordOutcome` correlates only by
   `providerRef`; a null one made it _insert_, and the new row (also null) became the match
   for the next message. Reverted to the direct `updateChannelData` path for that case.
3. **Payment promises could vanish from the detail view.** The migration nulls `resultado`
   on one-way channels, but their `PaymentPromise` rows survive and stay on the worklist.
   `ResultadoRow` now renders whenever a promise exists, not only when `resultado` is set.
4. **Twilio error map missed the common failures.** Added 30003/30005 (invalid destination),
   30006 (landline), 30008 (transient), so the permanent-vs-transient split actually works.
5. **The `outcome` → `resultado` eval rename failed open.** `evalExpectedSchema` was a
   permissive `z.object`, so a legacy suite kept parsing with the key stripped and every turn
   reported `passed: true`. Now `.strict()`.
6. **Config boot failure now explains itself** — both `webhookBaseUrl` fields carry a message
   naming the field, the consequence, and the two valid ways out.

**Not fixed, deliberately:**

- **Finding 4 — opted-out accounts re-enter rotation.** This is the accepted gap the user
  decided on explicitly (twice); `dnc_seed_from_intent_status` preserves the data for #101.
  Not re-litigated in review.
- **Finding 5 — EMAIL/WHATSAPP can never count as "reached"** (no delivery signal on either
  channel). Real, and a change in the _direction_ of an existing error rather than a new gap.
  Needs a product decision on the KPI plus two provider webhooks → filed as **issue #103**.

## Findings that must land in the build (stage 3)

- **`Resultado` disappears when there is no AI summary.** In `GestionDetail.tsx` the generic
  block is gated `hasGenericInsight && insight` (`:736`), so an SMS or pre-recorded gestión
  with no insight shows no result at all. Pencil has always had it as a standalone row.
- **Duplicate `Target` icon on the payment promise** — `GestionDetail.tsx:573` (Section
  header) and `:583` (inside the card). Pencil has no promise card at all: just
  `Resultado · Promesa de pago`. Make the code match Pencil. (User flagged this directly.)
- **The 45-line `deliveryValue` switch (`GestionDetail.tsx:239-284`) deletes entirely** — it
  reverse-engineers delivery from untyped `channelData.deliveryStatus` plus string sniffing
  (`status.includes("deliver")`), transcript length, and the outcome itself. With a typed
  `entrega` column it becomes one `t()` call.
- **Pencil showed the bug directly:** SMS and Pre-grabada blocks rendered
  `Resultado: Entregado` — a delivery word in the outcome row.

## Risk context (user, 2026-08-19) — read this before the warnings below

**One production customer, on preview terms, with roughly two days of campaign history.**

This is the calibration for everything that follows. Most of the migration risk recorded in
this file is a function of data volume and elapsed history, and at two days both are close to
nil:

- Accounts flagged `OPT_OUT` or `WRONG_NUMBER` are a handful at most — possibly zero. The
  export in task 4.9e stays mandatory but is minutes of work, not a project.
- A backup restore loses at most two days, and the migration itself runs in seconds on a table
  this small.
- The "everyone re-enters rotation at once" volume spike is bounded by the same handful of
  accounts.
- Back-fill imprecision (`WRONG_NUMBER` → delivery failure) mislabels at most two days of
  history rather than years of it.
- The single-shot migration — rather than expand/contract — is clearly correct at this scale.

**What does NOT get cheaper with one customer:** the `webhookBaseUrl` boot requirement. It is
binary — a mounted `qcobro.json` missing it means the apiserver does not start, at any scale.
Task 9.4 stays a hard gate.

## Decisions taken 2026-08-19 (user)

- **Ship as a SINGLE change** — one migration, one release. Expand/contract (two releases,
  `outcome` kept nullable through release 1) was proposed and **declined**. Consequences the
  user accepted explicitly:
  - There is a window during deploy where the migration has landed but old code is still
    serving; gestión writes fail in it.
  - Rollback is not code-only. `DROP TYPE "ContactOutcome"` is irreversible.
  - **Therefore two hard gates before production:** (1) the change is exercised against a
    real local stack first, and (2) a verified, restorable database backup exists before the
    migration runs. Neither is optional; both belong in stage 4.
- **`NEW_TERMS` inertness** → filed as **issue #100**, not fixed here. The change carries the
  bug forward unchanged rather than altering suppression behavior mid-migration.
- **Money rounding** → out of scope for this change; shipped separately as PR #98.
- **Delivery-failure suppression policy** → **no automatic suppression at all.** The engine
  benches nobody for a bad number. `intentStatus.WRONG_NUMBER` and the `WRONG_NUMBER` trigger
  type are deleted outright rather than left dormant ("we should always try to clean unused
  code"). `WRONG_PARTY` is a recorded fact on the gestión with no side effect.
  - Replacement is an explicit, labelled **Do Not Contact list** → **issue #101**.
  - Accepted consequence: until #101 ships, nothing stops the engine re-dialling numbers the
    carrier reports as invalid. Spend on dead numbers in the interim.
- **`IntentStatus` is reduced to `INTENT_MET` alone** (user, final). `OPT_OUT` is deleted
  along with `WRONG_NUMBER`, and both `TriggerType` values go too. `INTENT_MET` survives
  because it describes the _debt_ (settled, nothing to collect), not a contact point.
  - `resultado: OPT_OUT` is still **recorded** and visible; it just sets no account flag.
  - **Accepted gap:** until #101 ships, a request to stop contact is recorded but **not
    enforced** on the live channels (voice, email). Operators must work it by hand — the new
    resultado filter on Gestiones is what makes that possible at all. The user was told twice
    and confirmed; recorded here so it is not rediscovered as a surprise.
  - **Migration must export accounts currently flagged `OPT_OUT` before nulling them**
    (task 4.9e). Those are people who already asked not to be contacted and who re-enter
    rotation the moment the flag drops. That export seeds the DNC list — handed to #101.
  - WhatsApp's Meta-131050 path (`rest/whatsAppWebhook.ts:260`) stops writing `intentStatus`
    and must write into the DNC list once WhatsApp goes live. Inert today (channel unused).

## Open questions carried into stage 2

- Final name for `camino` (user: "we could probably call it camino, but I'm not set on that").
- `webhookBaseUrl` becomes **required within its section** (both `fonoster` and `twilio`
  sections stay `.optional()`), deleting `NO_CALLBACK_CONFIGURED` / `AWAITING_CALLBACK` and
  the "SMS remains fire-and-forget" scenario at `account-contact-log/spec.md:182`. Raises the
  stakes on the unauthenticated `POST /api/voice/events`.
- Sequencing: one change, or `entrega` as a first slice with `camino`/`resultado` following.
- `VOICEMAIL` is blocked on AMD (issue #83).
- Escalation gets **no dedicated column** (user decided). It is not persisted today either —
  `action: "escalate"` is a local variable that only suppresses an auto-reply. Worth a
  separate issue for a "conversaciones sin respuesta" filter so the silent-stop case stays
  findable.

## Superseded work

- **PR #96 (`fix/contactability-kpi`)** adds `DISPATCHED` as an _outcome_ and deletes `OTHER`
  from the public ingress — both superseded by this change. Close it, or strip it back to
  just the `contactStats` read-path fix.
- **PR #97 (`fix/money-workspace-locale`)** is independent and can merge on its own.
