## Why

The current portfolio model only supports `ACTIVE` and `CLOSED` states, which doesn't reflect real collections workflows where a portfolio may be temporarily paused or fully archived. Additionally, all row actions (sync, edit, delete) are exposed as separate buttons, cluttering the table and making delete too easy to trigger accidentally.

## What Changes

- Replace the `CLOSED` status with `PAUSED` and `ARCHIVED` — three states: `ACTIVE`, `PAUSED`, `ARCHIVED`
- Default list view shows `ACTIVE` and `PAUSED` portfolios; `ARCHIVED` portfolios are hidden unless explicitly filtered
- Replace per-row action buttons with a single ellipsis (⋯) menu containing: Sincronizar CSV, Editar, Eliminar
- Move the "Eliminar cartera" action out of the EditPortfolioModal and into the ellipsis menu exclusively
- Update filter dropdown to offer: All active (default), Active only, Paused only, Archived

## Capabilities

### New Capabilities

- `portfolio-row-actions`: Ellipsis dropdown menu on each portfolio row exposing Sync CSV, Edit, and Delete actions

### Modified Capabilities

- `web-console`: Portfolio list default view and filter options change; row action presentation changes
- `account`: Portfolio status enum changes from `[ACTIVE, CLOSED]` to `[ACTIVE, PAUSED, ARCHIVED]`

## Impact

- `mods/common` — `portfolioStatus` enum updated; `updatePortfolioSchema` references new values
- `mods/apiserver` — Prisma schema enum updated; migration required; `list` procedure default filter changes
- `mods/webapp` — Filter select options updated; row actions replaced with ellipsis menu component; EditPortfolioModal loses its delete button
- Pencil design file — portfolio list screen row actions updated; filter dropdown options updated
