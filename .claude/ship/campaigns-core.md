# Ship checkpoint — campaigns-core

Started: 2026-06-22
Current stage: 6 — Archive (deferred; change also covers agent-templates/gestiones/objetivos/account-contact-log)

**Focus:** Campaigns only. The campaigns-core change spans 6 spec areas; this run drives
**`campaigns` + `campaign-triggers`** to production-ready. Agent templates, gestiones,
objetivos, and account-contact-log are explicitly deferred to their own `/ps:ship` passes.

**Scope:** A Campaign is a scheduled outreach program linking ≥1 portfolio to one
AgentTemplate, with a status lifecycle (ACTIVE ⇄ PAUSED → COMPLETED → ARCHIVED), a daily
outreach window (startTime/endTime in deployment timezone), lifetime + daily attempt caps,
and per-campaign static/AI suppression triggers. Console screens: campaign list, "Nueva
campaña" modal, campaign detail (portfolios, triggers, simple fields).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: no · E2E: yes (Playwright)

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                                                                                                                    |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | 59/69 tasks done overall; all 10 remaining are §10 Pencil Design. Code scaffolded, design incomplete.                                                                                                                                                                                                                                                                    |
| 1   | Design (Pencil) | done   | List/create/edit/detail screens finalized; days-of-week toggle, split columns, PAUSED start, status-change UI. APPROVED.                                                                                                                                                                                                                                                 |
| 2   | Spec reconcile  | done   | campaigns + web-console reconciled (PAUSED, daysOfWeek, delete rule, simple detail, status UI). `openspec validate campaigns-core` → valid. Fixed 3 pre-existing SHALL-lint errors in deferred account-contact-log spec.                                                                                                                                                 |
| 3   | Build           | done   | Backend (12.1–12.6) + webapp (12.7–12.9): i18n day-humanizer (`lib/campaignDays.ts`) + en/es keys, Campaigns.tsx (7-day toggle, Días/Horario columns, Borrador removed, updateStatus actions), CampaignDetail.tsx (status controls + field card, KPIs/gestiones removed). Typechecks clean (only pre-existing Storybook + portfolios-test errors remain, out of scope).  |
| 4   | Test            | done   | 42 apiserver unit tests pass. Manual test passed. Edit modal added (was missing); e2e extended to cover rename + day change (step 11.4) and detail after edit (step 11.5).                                                                                                                                                                                               |
| 5   | Sync            | done   | Created `openspec/specs/campaigns/spec.md` + `openspec/specs/campaign-triggers/spec.md` from delta (all ADDED). Validated clean.                                                                                                                                                                                                                                         |
| 6   | Archive         | done   | 2026-06-22: completed partial sync (account-contact-log main spec created; portfolio-accounts hot-path req + web-console campaign list/create/detail reqs appended). Gestiones/Objetivos web-console reqs deferred to new `gestiones` change (5 design tasks split out). `openspec validate --all` = 17 passed. Archived to `changes/archive/2026-06-22-campaigns-core`. |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decisions to carry into Spec (stage 2) + Build (stage 3)

These design changes alter behavior and MUST land in the spec/enum/schema/code:

1. **Days-of-week scheduling (NEW field).** Campaign gains `daysOfWeek` — the set of weekdays
   it runs (ISO 1=Mon…7=Sun). Arbitrary combinations allowed. The webapp derives a humanized
   i18n label (Entre semana / Fines de semana / Lun a Vie / single day / Todos los días / custom
   list). Touches: `campaigns` spec "schedule" requirement, `Campaign` model + migration,
   `createCampaignSchema`/`updateCampaignSchema`, create/update functions, list column + detail.
2. **Drop DRAFT; start at PAUSED.** Creation requires full config, so there is no partial-draft
   state — a new campaign is complete but not running = PAUSED. New lifecycle:
   `PAUSED ⇄ ACTIVE → COMPLETED → ARCHIVED` (initial PAUSED). Remove `DRAFT` from `CampaignStatus`
   enum. Touches: `campaigns` spec lifecycle requirement, enum + migration, createCampaign default,
   all status badges/copy.
3. **Deletion rule change (follows from #2). CONFIRMED.** Was "only DRAFT deletable." New:
   deletable while the campaign has no recorded attempts (`attemptCount`/`totalCalls` = 0).
   Touches: `campaigns` spec, deleteCampaign function + its test.
4. **Status-change UI.** Detail screen header carries the primary transition (Activar/Pausar) +
   overflow (Completar/Archivar); list keeps row-action transitions. Build: wire to a campaign
   status-update procedure/function.

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-22 — Post-sync: added EditCampaignModal + "Editar" row action (gap found by user); e2e extended with edit step (rename + toggle day → Lun, Vie, Sáb). Typecheck clean.
- 2026-06-22 — Sync (stage 5): created openspec/specs/campaigns/ + campaign-triggers/ from delta. openspec validate clean.
- 2026-06-22 — Post-build: default status changed from PAUSED → ACTIVE (user decision). Updated: createCampaign fn + test, schema.prisma, migration SQL, live DB default, comments in updateCampaignStatus/deleteCampaign/schemas, spec scenario, e2e (create→Activa, transition test flipped to Pausar→Pausada). 42 unit tests still green.
- 2026-06-22 — Build+Test: webapp done (day humanizer, toggle, columns, status controls); 42 unit tests pass; e2e rewritten. Paused for user manual test before Sync (stage 5).
- 2026-06-22 — Build (backend): enum DRAFT→removed (default PAUSED), `daysOfWeek Int[]` added to schema+migration; common schemas/types updated; createCampaign/deleteCampaign reworked; updateCampaignStatus fn + procedure added. apiserver typechecks clean (pre-existing portfolios test errors are out of scope). Webapp + tests next.
- 2026-06-22 — Design: replaced Días Select with an explicit 7-day toggle (L M X J V S D) in both modals so individual-day selection (e.g. Mon+Fri) is clear; humanized label drives read views. Deletion rule confirmed: deletable while no recorded attempts.
- 2026-06-22 — Design: dropped DRAFT/Borrador → campaigns start PAUSED; added status-change UI to detail header; fixed list badges.
- 2026-06-22 — Design: added days-of-week (`daysOfWeek`) to create/edit modals; split list "Horario" into Días (humanized) + Horario (time-only) columns; built simple Campaña · Detalle screen (no KPIs, mirrors campaign fields).
- 2026-06-22 — Framed. Scoped to campaigns + campaign-triggers only; rest of campaigns-core deferred. Entering Design.
