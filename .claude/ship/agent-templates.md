# Ship checkpoint — agent-templates

Started: 2026-06-22
Current stage: 1 — Design (Pencil, in-progress)

**Focus:** Agent templates only (from campaigns-core delta spec). Covers list, create,
edit, and detail screens. Backend (schema, functions, router) already scaffolded; this
pass refines the model and builds the missing edit modal.

**Detected surfaces:** OpenSpec: yes (campaigns-core change) · Pencil: yes (pencil.pen) · Storybook: no · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                                            |
| :-- | :-------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Scoped to agent-templates from campaigns-core delta. Existing scaffold needs edit modal, strategy removal, and voices-from-config.                                               |
| 1   | Design (Pencil) | done    | Pencil updated: list (Nombre/Canal/Creado/Actions), create modal (VOICE_AI form), edit modal (type read-only), detail (no KPIs, config+campaigns cards). Awaiting user approval. |
| 2   | Spec reconcile  | pending |                                                                                                                                                                                  |
| 3   | Build           | pending |                                                                                                                                                                                  |
| 4   | Test            | pending |                                                                                                                                                                                  |
| 5   | Sync            | pending |                                                                                                                                                                                  |
| 6   | Archive         | pending | Will archive agent-templates delta when done; rest of campaigns-core change stays open.                                                                                          |

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

- 2026-06-22 — Status→archived refactor: removed `PortfolioStatus` enum and the planned agent status enum; both entities now use `archivedAt`. Code + specs done and green (48 tests, typecheck/lint clean). Pencil portfolio-list skipped per user.
- 2026-06-22 — Design (Pencil): list/create/edit/detail screens drawn. Archive lifecycle added (status enum, Archivar row action, Archivados filter, no status column).
- 2026-06-22 — Framed. Terminal mockups drawn and approved. Strategy removed, voices from config, VOICE_AI field reorder, VOICE_PRERECORDED loses firstMessage, detail loses KPIs. Language stays on child config tables.
