# Ship checkpoint — workspace-settings

Started: 2026-06-28
Current stage: build+unit done; Pencil + e2e + sync/archive remain

**Scope:** Introduce an app-owned `WorkspaceSettings` store (keyed by `workspaceRef`, not
Identity) that owns **currency** and **timezone**. Move currency off `Portfolio` (drop the
column + remove from create/sync/forms; format money from the workspace currency) and move
timezone off the deployment-wide `qcobro.json` (the engine reads per-workspace tz; qcobro.json
becomes the seed default). Add Currency + Timezone fields to "Configuración del espacio".

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo-root `pencil.pen`) · Storybook: yes (@qcobro/webapp) · E2E: yes (Playwright)

| #   | Stage           | Status                  | Notes                                                                                                                                                                                                                                                                                                                               |
| :-- | :-------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done                    | Artifacts authored + valid (proposal/design/5 specs/tasks); surfaces detected                                                                                                                                                                                                                                                       |
| 1   | Design (Pencil) | deferred                | Per user: do Pencil at the end; design delta is tiny (2 fields added, 1 removed)                                                                                                                                                                                                                                                    |
| 2   | Spec reconcile  | done                    | No design drift (Pencil deferred); specs as-authored, valid                                                                                                                                                                                                                                                                         |
| 3   | Build           | done                    | common (WorkspaceSettings schema/types; currency off portfolio; outreach ctx) + apiserver (model+migration applied, settings fns+router, ctx+engine per-ws tz/currency, currency off create/sync/email) + webapp (settings currency+tz, money via workspace currency, currency off portfolio form) + sdk. All build/lint/test green |
| 4   | Test            | unit done; e2e deferred | 159 unit tests pass (getWorkspaceSettings seed, updateWorkspaceSettings validation-failure, portfolio create no-currency); migration applied+no drift on dev DB. e2e (6.4) deferred (flaky bootstrap)                                                                                                                               |
| 5   | Sync            | pending                 | via /opsx:sync (gate)                                                                                                                                                                                                                                                                                                               |
| 6   | Archive         | pending                 | via /opsx:archive (gate)                                                                                                                                                                                                                                                                                                            |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-28 — Build complete: WorkspaceSettings store wired through common/apiserver/webapp/sdk; engine resolves per-campaign workspace tz+currency; migration is structural (drop Portfolio.currency + create workspace_settings) — greenfield so no backfill needed, seed-on-read covers defaults. 159 unit tests pass; build+lint+migration(no drift) green. Pencil + e2e + sync/archive remain.

- 2026-06-28 — Option 3 + tweak: per-workspace settings store owns currency AND timezone; remove Portfolio.currency (incl. sync); qcobro.json timezone demoted to seed default. No Identity changes.
- 2026-06-28 — Checkpoint created; change proposed + valid; dashboard refinement (KPIs/contact-rate) already committed (35be7e0) to keep this change clean.
