# Ship checkpoint — workspace-settings

Started: 2026-06-28
Current stage: 6 — Archived (done). e2e skipped per user.

**Scope:** Introduce an app-owned `WorkspaceSettings` store (keyed by `workspaceRef`, not
Identity) that owns **currency** and **timezone**. Move currency off `Portfolio` (drop the
column + remove from create/sync/forms; format money from the workspace currency) and move
timezone off the deployment-wide `qcobro.json` (the engine reads per-workspace tz; qcobro.json
becomes the seed default). Add Currency + Timezone fields to "Configuración del espacio".

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo-root `pencil.pen`) · Storybook: yes (@qcobro/webapp) · E2E: yes (Playwright)

| #   | Stage           | Status                 | Notes                                                                                                                                                                                                                                                                                                                               |
| :-- | :-------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done                   | Artifacts authored + valid (proposal/design/5 specs/tasks); surfaces detected                                                                                                                                                                                                                                                       |
| 1   | Design (Pencil) | done                   | Consolidated single "Preferencias" box: name + Moneda (select) + Zona horaria (select); webapp merged to match                                                                                                                                                                                                                      |
| 2   | Spec reconcile  | done                   | No design drift (Pencil deferred); specs as-authored, valid                                                                                                                                                                                                                                                                         |
| 3   | Build           | done                   | common (WorkspaceSettings schema/types; currency off portfolio; outreach ctx) + apiserver (model+migration applied, settings fns+router, ctx+engine per-ws tz/currency, currency off create/sync/email) + webapp (settings currency+tz, money via workspace currency, currency off portfolio form) + sdk. All build/lint/test green |
| 4   | Test            | unit done; e2e skipped | 159 unit tests pass; migration applied (no drift). e2e skipped per user.                                                                                                                                                                                                                                                            |
| 5   | Sync            | done                   | 5 main specs updated (workspace-settings new; campaigns tz, sdk-portfolios + channel-dispatch currency, web-console settings); all validate                                                                                                                                                                                         |
| 6   | Archive         | done                   | changes/archive/2026-06-28-workspace-settings                                                                                                                                                                                                                                                                                       |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-28 — Pencil + webapp consolidated to ONE "Preferencias" box (name + currency + timezone selects). Committed code (feat). Synced 5 specs to main. Archived. e2e skipped per user. NOTE: pencil.pen design edits live in the app but not yet saved to disk — commit the design after a save.

- 2026-06-28 — Build complete: WorkspaceSettings store wired through common/apiserver/webapp/sdk; engine resolves per-campaign workspace tz+currency; migration is structural (drop Portfolio.currency + create workspace_settings) — greenfield so no backfill needed, seed-on-read covers defaults. 159 unit tests pass; build+lint+migration(no drift) green. Pencil + e2e + sync/archive remain.

- 2026-06-28 — Option 3 + tweak: per-workspace settings store owns currency AND timezone; remove Portfolio.currency (incl. sync); qcobro.json timezone demoted to seed default. No Identity changes.
- 2026-06-28 — Checkpoint created; change proposed + valid; dashboard refinement (KPIs/contact-rate) already committed (35be7e0) to keep this change clean.
