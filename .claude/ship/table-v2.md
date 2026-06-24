# Ship checkpoint — table-v2

Started: 2026-06-23
Current stage: DONE (committed; Sync/Archive N/A — no OpenSpec change)

**Scope:** Upgrade the shared webapp table to the new Pencil "Comp/Table V2" design
(gray header, 12px card, external toolbar, status pills, optional selection column with
two-line primary cell), publish all variants in Storybook, and migrate every table page
to it. One page (Cartera · Detalle / accounts) gets the "richer control" selection variant.

**Detected surfaces:** OpenSpec: yes (no change for this work) · Pencil: yes (Table V2 = `Y0cy6y`, design approved) · Storybook: yes (webapp) · E2E: nominal only (root `test:e2e` script, no config/dir) · Webapp unit runner: none

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                         |
| :-- | :-------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Surfaces detected; 7 live DataTable call sites + 1 non-table (Home)                                                                                                                                                                                                           |
| 1   | Design (Pencil) | done    | Table V2 already designed & approved by user; HTML exported + studied                                                                                                                                                                                                         |
| 2   | Spec reconcile  | skipped | Pure UI/styling restyle; specs = behavior not styling. Re-open only if a real backend bulk action is added for selection.                                                                                                                                                     |
| 3   | Build           | done    | data-table.tsx rewritten to V2 (selection, TableCellStack, i18n chrome, toolbar outside card); stories rebuilt; preview.tsx global I18nProvider; BulkReachOutModal; PortfolioDetail (selection+2-line+bulk) & Gestiones (2-line) migrated; 5 other pages inherit V2 unchanged |
| 4   | Test            | done    | typecheck ✅ · lint ✅ (0 err) · storybook:build ✅ · webapp build ✅. No webapp unit runner / no playwright config → unit+e2e N/A                                                                                                                                            |
| 5   | Sync            | skipped | No OpenSpec delta to promote                                                                                                                                                                                                                                                  |
| 6   | Archive         | skipped | No OpenSpec change to archive                                                                                                                                                                                                                                                 |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Findings (Table V2 vs current `data-table.tsx`)

- **Card**: white, `border 1px #E2E8F0`, `rounded-12`, `overflow-hidden`. Toolbar is a
  SIBLING ABOVE the card (current embeds it inside with a bottom border) — needs moving out.
- **Header row**: 44px, bg `#F8FAFC` (current is white); header text `12px #64748B font-semibold
tracking-0.3px` (current `13px`, no tracking). Date/numeric headers right-aligned.
- **Data row**: 52px, bottom border `#F1F5F9` (last none). First column is a two-line stack
  (Name `14px #0F172A medium` + Sub `12px #64748B`).
- **Status pill** = existing `Badge` exactly (`success bg-#ECFDF5/text-#10B981`,
  `orange bg-#FFFBEB/text-#D97706`, `secondary bg-slate-100/text-#0F172A`). Reuse Badge.
- **Selection column** (NEW, "richer control"): 48px, header select-all + per-row 16px checkbox.
- **Actions cell**: 80px centered, 28×28 ellipsis "More Button" → existing `RowActionsMenu`.
- **Footer**: top border `#E2E8F0`, row count (`13px #64748B`) + `Pagination`.
- **i18n bug to fix**: current component hardcodes `"Mostrando … resultados"` (violates
  CLAUDE.md i18n rule). V2 routes row-count/empty/selection chrome through `useI18n`.

## Call sites (7 live + 1 N/A)

1. PortfolioDetail (accounts) — search, pagination, action, row menu, row click → **selection variant**, two-line name+externalId
2. Gestiones — 2 filters, pagination, row click → two-line debtor cell
3. Portfolios — archived filter, action, row menu, row click
4. Campaigns — status filter, action, row menu, row click
5. AgentTemplates — type+archived filters, action, row menu, row click
6. Objetivos — status filter, row menu (KPI row above)
7. ApiKeys — action, row menu
8. Home — custom activity list, NOT a DataTable → out of scope

## Build spec (ready for Sonnet 4.6)

Rewrite `mods/webapp/src/components/ui/data-table.tsx` to V2, additive API:

- Keep existing props (`columns`, `data`, `keyField`, `searchable`, `searchPlaceholder`,
  `filterElement`, `actionLabel`, `onAction`, `onRowClick`, `page`, `totalPages`,
  `onPageChange`, `totalRecords`, `className`).
- ADD: `selectable?: boolean`, `selectedIds?: Set<string> | string[]`,
  `onSelectionChange?(ids)`, `getRowId?(row)` (falls back to `keyField`),
  `bulkActions?: ReactNode` (rendered in toolbar when selection non-empty).
- Move toolbar OUT of the card (sibling above). Card = header+rows+footer only.
- Header bg `#F8FAFC`, text `12px font-semibold text-[#64748B] tracking-[0.3px]`,
  right-align numeric/date headers (reuse `col.align`).
- Rows 52px, divider `#F1F5F9`, last row borderless. Hover `bg-slate-50`.
- Selection column 48px: header = indeterminate-aware select-all; rows = 16px checkbox.
  Clicking a checkbox must `stopPropagation` so it doesn't trigger `onRowClick`.
- Export `TableCellStack({title, sub})` for two-line first column.
- Route chrome through `useI18n`: add MessageIds `table.rowCount` (needs count interp —
  check `t()` interpolation in i18n.tsx; if none, format in component and pass parts),
  `table.empty`, `table.selected`, `table.selectAll`. Add to BOTH `es` and `en` blocks.
- Status pills already = `Badge`; do not build a new pill.

Stories (`data-table.stories.tsx`, keep title "UI/DataTable"): Default, With Pagination,
With Search + Action, With Filter, Two-line cell, **Selectable (with bulk bar)**, Empty.

Migration (7): PortfolioDetail (selectable + two-line name/externalId; bulk bar reuses
ReachOut per-row flow over selected — no new endpoint), Gestiones (two-line debtor),
Portfolios, Campaigns, AgentTemplates, Objetivos, ApiKeys.

Gate: `npm run typecheck`, `npm run lint`, `npm run storybook:build` (webapp) all green.

## Decision log

Newest first.

- 2026-06-24 — Post-review fix: added `cursor-pointer` to Button/IconButton bases, Select/FilterSelect, Dialog close button, and the selection-bar clear button (Tailwind Preflight is disabled, so native button/select had no pointer). Committed. Ship complete — Sync/Archive remain N/A (no OpenSpec change).
- 2026-06-24 — Build + Test stages done. All gates green (typecheck/lint/storybook/build). Selection wired via BulkReachOutModal reusing `outreach.dispatch` per account (no new endpoint). Awaiting user visual review in Storybook before commit.
- 2026-06-24 — User confirmed: (1) selection = **visual + reuse existing reach-out flow**, no new backend → stays pure UI; (2) strategy = **rewrite data-table.tsx in place**. Build spec finalized above. Ready to implement on Sonnet 4.6.
- 2026-06-23 — Study complete on Opus 4.8. Spec/Sync/Archive marked skipped (styling refactor, no OpenSpec change). Two open decisions raised to user (selection backend behavior; in-place rewrite vs parallel component). Build to run on Sonnet 4.6.
- 2026-06-23 — Checkpoint created.
