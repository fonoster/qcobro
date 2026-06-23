# Ship checkpoint — console-refinements

Started: 2026-06-23
Current stage: 6 — Archive (DONE)

**Scope:** A "low hanging fruit first" operator-console refinement pass: campaign
archive/unarchive from the list (ARCHIVED → PAUSED restore), optional VOICE_AI first
message, dropping the creation-date column from the Carteras/Campañas/Agentes tables, and
wiring the Panel de control widgets (Gestiones recientes, Progreso por cartera w/ simulated
10–80%, Cuentas en gestión) to live data. No new screens, no new backend endpoints.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (skipped — no new screens) · Storybook: yes · E2E: yes (root playwright.config.ts + e2e/)

| #   | Stage           | Status  | Notes                                                                                                                                                                        |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Created change `console-refinements`; agent archive/unarchive already exists; campaign archive backend exists.                                                               |
| 1   | Design (Pencil) | skipped | No new screens — column removals, row-action buttons, data wiring only; user asked to skip design and prioritize low-hanging fruit.                                          |
| 2   | Spec reconcile  | done    | Delta specs written for campaigns (ARCHIVED restorable), agent-templates (firstMessage optional), web-console (table cols + dashboard). `openspec validate --strict` passes. |
| 3   | Build           | done    | Original 5 groups + 9-item cleanup pass. Prisma migration `first_message_optional` applied. Config single-sourced from qcobro.json (.env/.env.example removed).              |
| 4   | Test            | done    | +2 unit and new e2e `console-refinements.spec.ts`. typecheck (3) + lint clean + unit (10+65) + e2e (4 affected) all green. data-persistence spec reconciled to qcobro.json.  |
| 5   | Sync            | done    | Delta promoted into campaigns, agent-templates, data-persistence, web-console main specs. All 16 specs validate --strict.                                                    |
| 6   | Archive         | done    | Moved to openspec/changes/archive/2026-06-23-console-refinements. 16 main specs validate. Ship complete.                                                                     |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-23 — Removed root `.env`/`.env.example`: qcobro reads all config from qcobro.json; build sources DATABASE_URL via prisma wrapper. Reconciled data-persistence spec.
- 2026-06-23 — Cleanup pass (9 items) done: reserved language col, first-msg input+placeholder, Voz IA-only sync, human-friendly lang, timezone→top-level, voicePort surfaced. All gates green.
- 2026-06-23 — Build + Test done, all gates green (incl. e2e on live stack). Stopping at Sync gate.
- 2026-06-23 — Decisions: unarchive restores campaign to PAUSED (no auto-dispatch); Cuentas en gestión = sum of active carteras' accountCount; per-cartera progress deterministic 10–80%.
- 2026-06-23 — Design skipped (no new screens); spec reconcile done; entering Build.
- 2026-06-23 — Checkpoint created; framing the change.
