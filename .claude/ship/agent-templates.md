# Ship checkpoint — agent-templates

Started: 2026-06-22
Current stage: 3 — Build (in-progress)

**Focus:** Agent templates only (from campaigns-core delta spec). Covers list, create,
edit, and detail screens. Backend (schema, functions, router) already scaffolded; this
pass refines the model and builds the missing edit modal.

**Phase 2 (2026-06-22, /ps:ship agents):** VOICE_AI screens are done/approved. Now designing
the missing per-channel screens — create modal + detail page for each of SMS,
VOICE_PRERECORDED (voz pregrabada), EMAIL (correo), WHATSAPP. 8 new screens added to the
AGENTES cluster (kdY0h) as new rows in SCQUy. Field sets taken from the agent-templates
delta spec + recorded decisions (no collection-strategy field; voz pregrabada uses "Guión"
not "Primer mensaje"; sync badge shown only on voice detail). After design approval: build
agents incl. Fonoster voz pregrabada + voz IA integration; other integrations deferred.

**Detected surfaces:** OpenSpec: yes (campaigns-core change) · Pencil: yes (pencil.pen) · Storybook: no · E2E: yes (Playwright)

| #   | Stage           | Status   | Notes                                                                                                                                                                                                                                                                                                                             |
| :-- | :-------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done     | Scoped to agent-templates from campaigns-core delta. Existing scaffold needs edit modal, strategy removal, and voices-from-config.                                                                                                                                                                                                |
| 1   | Design (Pencil) | done     | VOICE_AI + 8 channel screens (create+detail per SMS/Voz pregrabada/Correo/WhatsApp) approved. Variables hint added to all list-header backgrounds.                                                                                                                                                                                |
| 2   | Spec reconcile  | done     | agent-templates + web-console deltas reconciled: removed collectionStrategy + counters + KPIs, dropped VOICE_PRERECORDED firstMessage, added voice-catalog-from-config + documented-template-variables requirements. `openspec validate` green. Tasks §13 added.                                                                  |
| 3   | Build           | done     | All of §13 built: model reconcile (strategy/counters/firstMessage removed, migration), voices-from-config + `config` tRPC router, webapp forms/detail/list + variables hint, Fonoster Voz IA integration (port + adapter + DI + create/update/sync, 15s timeout). lint/typecheck/55 unit tests green.                             |
| 4   | Test            | done     | Unit: 55 pass (incl. sync create/fail/manual). E2E: 15 pass against running stack — updated campaigns-core VOICE_AI flow for config-sourced Voz/Idioma selects + variables-hint assertion; added SMS-channel test (form variant, detail config, no sync badge). lint + typecheck green. DB re-baselined to single init migration. |
| 5   | Sync            | done     | User approved sync-only (no archive). Scoped to this run's reconciled specs: created main `openspec/specs/agent-templates/spec.md` (8 requirements) + added "Agent Templates section" to main web-console. `openspec validate --all` = 15 passed. campaigns-core stays open.                                                      |
| 6   | Archive         | deferred | Intentionally NOT archived — campaigns-core has open slices (gestiones/objetivos designs 10.8-10.11; deferred VOICE_PRERECORDED + SMS/Email/WhatsApp dispatch). Archive when the whole change lands.                                                                                                                              |

## Approved design decisions

**A — Remove "Estrategia de cobranza" everywhere**

- A1. Drop Estrategia column from list
- A2–A4. Remove from create modal, edit modal, detail card
- A5. Remove from createAgentTemplateSchema + updateAgentTemplateSchema
- A6. Remove collectionStrategy from Prisma AgentTemplate model + migration

**B — Voices from qcobro.json**

- B1. Add `voices: { id, name, language, gender, provider }[]` to config schema (provider defaults to "elevenlabs")
- B2. Seed 3 Spanish voices: sofía (es, female), carmen (es, female), andrés (es, male) — all elevenlabs
- B3. Expose via config.voices tRPC query
- B4. Replace free-text voice input with <select> showing "Sofía (es, femenina)" labels in both voice modals
- B5. Detail shows voice name + language + gender, not raw ID

**C — VOICE_AI field changes**

- C1. "Primer mensaje" moves ABOVE "Prompt del sistema"
- Language stays on VoiceAiConfig child table (no schema change)

**D — VOICE_PRERECORDED field changes**

- D1. Remove "Primer mensaje" from form and schema (firstMessage dropped from VoicePrerecordedConfig)
- Language stays on VoicePrerecordedConfig child table (no schema change)

**E — Detail page**

- E1. Remove KPI strip entirely

**F — Agent archive lifecycle (BUILT 2026-06-22 — no status enum)**

- Decision: NO status enum on agents or portfolios. Use a single `archivedAt DateTime?`
  (null = active, set = archived), mirroring `PortfolioAccount`.
- F1. ✅ `AgentTemplate.archivedAt` + `Portfolio.archivedAt`; dropped `PortfolioStatus`
  enum + `Portfolio.status`. Migration `20260622_replace_status_with_archived` applied.
- F2. ✅ Default list excludes archived (`archivedAt: null` unless `includeArchived`).
- F3. ✅ List gains a "Mostrar archivados" toggle (not a filter option).
- F4. ✅ Row action Archivar/Restaurar; "Archivado/Archivada" badge on archived rows.
- F5. ✅ Archive handled inside `update*` (maps `archived: boolean` → `archivedAt`); no
  separate status procedure. Unit tests added for archive + restore (both entities).
- Specs reconciled: `portfolio-row-actions`, `portfolios`, agent-templates delta.
- Pencil: agent screens already have no status column; portfolio-list Pencil tweak
  deferred (user chose to skip — no dedicated status column found in the file).

**Not changing:** SMS / Email / WhatsApp fields; fonosterAppName/Ref (hidden); sync badge on voice detail.

## Decision log

- 2026-06-23 — DB migration re-baseline (user-authorized; WIP, no prod). `migrate dev` was
  failing two ways: (1) pre-existing ordering bug — two hand-authored 8-digit-prefix migrations
  (`20260617_add_portfolio_currency/_status_enum`) sorted before `20260617142222_add_portfolios`,
  breaking fresh shadow-DB replay; (2) drift on `campaigns.daysOfWeek` default. Squashed all
  migrations into one clean baseline `20260623014937_init` generated from schema.prisma (reset
  dev DB via PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION). `migrate dev`/`status` now clean.
- 2026-06-22 (Phase 2, build) — Stage 3 complete. Model reconcile: dropped collectionStrategy
  - counters from AgentTemplate and firstMessage from VoicePrerecordedConfig (migration
    20260622_drop_strategy_counters_prerecorded_firstmessage); removed CollectionStrategy enum;
    createContactLog no longer bumps template counters; fixed pre-existing syncAccounts.test typecheck.
    Voices-from-config: `voices` + `fonoster` blocks in config.ts/qcobro.json/qcobro-prod.json;
    new `config` tRPC router (voices query); webapp voice picker + detail voice label from catalog.
    Webapp: removed strategy/KPI; enabled WhatsApp; all 5 channel field sets; variables hint + i18n.
    Fonoster Voz IA: VoiceApplicationClient port (common) + FonosterVoiceApplicationClient adapter
    (@fonoster/sdk, AUTOPILOT app, 15s timeout) injected via context; create/update best-effort sync,
    syncAgentTemplate manual re-sync (errors propagate); webapp re-sync button + error badge. Unit
    tests: 55 pass (create syncs / saves-locally-on-fail / non-voice no-op; manual create/update/fail/no-op).
    Pre-recorded + SMS/Email/WhatsApp dispatch deferred per user. lint + typecheck + tests green.
- 2026-06-22 (Phase 2) — Built 8 per-channel agent screens in cluster kdY0h (rows added to
  SCQUy), each a Copy of the VOICE_AI create modal (MZxoy) / detail (oK2Cr) with the form
  body (eJvSb) / config body (n2oNx) replaced via Copy-descendants:
  - SMS create/detail (ids tAqkz/uDiuQ): Cuerpo del mensaje (placeholders) + ID de remitente; no sync badge.
  - Voz pregrabada (MnECY/Ju16B): Idioma, Voz, Guión; keeps Sincronizado badge (Fonoster).
  - Correo (iKZY0/aOFYW): Nombre/Correo del remitente, Asunto, Cuerpo del mensaje; no sync badge.
  - WhatsApp (UiHd4/g9fBF): Nombre de plantilla, Cuerpo del mensaje; no sync badge.
    Field components reused: BoM07 (input), M78oI (select), uJnVk (textarea). Type badge =
    mmFpk/eimgZ; sync badge UcZ3q disabled for text channels.
- 2026-06-22 (Phase 2) — Added a template-variables hint to the Agentes IA list header
  (ailmx, node DQWkd): "Variables:" + monospace chips {{firstName}} {{principalAmount}}
  {{outstandingBalance}} + "Ver variables disponibles" link (href placeholder
  docs.qcobro.com/agentes/variables, external-link icon). Hint replicated into all six
  list-header backgrounds behind the create/edit modals (Titles frames OP6BO, yU2ld,
  t39HvD, LausT, hgrmv, m4v81O) so every screen showing the Agentes IA list is consistent;
  detail-page headers (channel badge) excluded by design. No layout problems. Awaiting
  final approval to move into spec reconcile + build.
- 2026-06-22 — Status→archived refactor: removed `PortfolioStatus` enum and the planned agent status enum; both entities now use `archivedAt`. Code + specs done and green (48 tests, typecheck/lint clean). Pencil portfolio-list skipped per user.
- 2026-06-22 — Design (Pencil): list/create/edit/detail screens drawn. Archive lifecycle added (status enum, Archivar row action, Archivados filter, no status column).
- 2026-06-22 — Framed. Terminal mockups drawn and approved. Strategy removed, voices from config, VOICE_AI field reorder, VOICE_PRERECORDED loses firstMessage, detail loses KPIs. Language stays on child config tables.
