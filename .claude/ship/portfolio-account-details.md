# Ship checkpoint — portfolio-account-details

Started: 2026-06-30
Current stage: DONE — archived to openspec/changes/archive/2026-06-30-portfolio-account-details

**Scope:** Add a "Ver metadata" expandable JSON-tree section to the existing "Ver detalle"
account dialog on PortfolioDetail.tsx, so operators can inspect the full
`PortfolioAccountRecord` (principal, terms, missed installments, last payment,
negotiation options, etc.) beyond the 4 currently-shown basic fields. No backend
changes — `portfolios.listAccounts` already returns the full record.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (skipped — composes existing Dialog +
Accordion primitives, no new screen) · Storybook: yes (webapp) · E2E: root
playwright.config.ts + e2e/

| #   | Stage           | Status  | Notes                                                                                                                                                                                                         |
| :-- | :-------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done    | No prior change/checkpoint for this; created `openspec/changes/portfolio-account-details` via `/opsx:propose`.                                                                                                |
| 1   | Design (Pencil) | skipped | Composes existing `Dialog` + `Accordion` primitives inside an already-shipped dialog; no new visual language. See design.md "Decisions".                                                                      |
| 2   | Spec reconcile  | done    | ADDED requirement "Portfolio account detail dialog" to web-console delta. `openspec validate portfolio-account-details --strict` passes.                                                                      |
| 3   | Build           | done    | `PortfolioDetail.tsx`: `Accordion` under the existing `<dl>`, filters basic-field keys out of the raw record, `portfolios.detail.viewMetadata` i18n key (en/es). typecheck + eslint clean.                    |
| 4   | Test            | done    | Added `e2e/portfolio-account-details.spec.ts` (webapp has no unit-test runner) — collapsed by default, expands to show non-basic fields. Passes. Manually verified in the running app via browser automation. |
| 5   | Sync            | done    | Appended "Portfolio account detail dialog" requirement to main `openspec/specs/web-console/spec.md`. `openspec validate --all` = 31 passed.                                                                   |
| 6   | Archive         | done    | Archived to `openspec/changes/archive/2026-06-30-portfolio-account-details`.                                                                                                                                  |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-30 — Synced main `web-console` spec and archived the change. Also fixed the
  live Pencil design (not part of this change's scope, but caught during the same
  session): both Carteras · Lista (`wcl2T`) and Cartera · Detalle (`F5CG54`) instanced
  the shared `Comp/Table V2` component (`Y0cy6y`), which bakes in a generic "Estado"
  header + per-row status badges neither portfolio screen overrides away — so the design
  file still showed a status column the code never had. Disabled the header/row status
  cells on both instances (`XiBK6`, `umfHB`) via descendant `enabled: false` overrides.
- 2026-06-30 — User feedback: renamed the section from "Ver más" to "Ver metadata" (en:
  "View metadata") — "Ver más" reads like more list items, not a technical/raw-record
  view, and could set the wrong expectation. Renamed the i18n key too
  (`portfolios.detail.viewMetadata`) and updated proposal/design/specs/tasks/e2e to match.
- 2026-06-30 — Build + test complete: Accordion composition in `PortfolioDetail.tsx`,
  e2e spec added and passing, manual browser verification of collapsed/expanded states.
- 2026-06-30 — Proposal/design/specs/tasks created and validated via `/opsx:propose`.
  Decided to skip a Pencil pass (reuses existing Dialog+Accordion, diagnostic view not a
  new screen) — matches `console-refinements` precedent for low-hanging-fruit UI work.
- 2026-06-30 — Checkpoint created; framing the change.
