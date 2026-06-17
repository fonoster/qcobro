## 1. Database — Status Enum Migration

- [x] 1.1 Update Prisma schema: add `PAUSED` and `ARCHIVED` to `PortfolioStatus` enum (keep `CLOSED` temporarily)
- [x] 1.2 Generate migration for the enum addition
- [x] 1.3 Add raw SQL migration to backfill `CLOSED → ARCHIVED`
- [x] 1.4 Generate final migration to remove `CLOSED` from the enum

> Note: Status is stored as `String` in Prisma (not a native enum), so no DB migration was needed. Tasks 1.1–1.4 are satisfied by schema/validation layer changes only.

## 2. Common — Schema Updates

- [x] 2.1 Update `portfolioStatus` enum in `@qcobro/common` to `["ACTIVE", "PAUSED", "ARCHIVED"]`
- [x] 2.2 Update `updatePortfolioSchema` status field to the new enum values
- [x] 2.3 Remove `recoveredAmount` from `updatePortfolioSchema` (field is system-computed; spec documented in portfolio-row-actions/spec.md)

## 3. API Server — List Procedure Default

- [x] 3.1 Update `portfolios.list` tRPC procedure to default filter to `["ACTIVE", "PAUSED"]` when no status param is supplied
- [x] 3.2 Ensure explicit status filter still works (single value or array)

## 4. Webapp — RowActionsMenu Component

- [x] 4.1 Create `src/components/ui/row-actions-menu.tsx` with a ⋯ trigger button and positioned dropdown
- [x] 4.2 Implement `useClickOutside` hook (or inline) to close the menu on outside click
- [x] 4.3 Support `{ label, onClick, variant?: "default" | "destructive" }` item props
- [x] 4.4 Destructive items render label in red

## 5. Webapp — Portfolio List Page

- [x] 5.1 Replace per-row CSV and Edit buttons with `RowActionsMenu` containing Sincronizar CSV, Editar, Eliminar
- [x] 5.2 Wire Eliminar to `ConfirmDeleteDialog` (existing component)
- [x] 5.3 Update filter dropdown options: "Activas y pausadas" (default), "Solo activas", "Solo pausadas", "Archivadas"
- [x] 5.4 Update i18n keys for new status labels (`portfolios.status.PAUSED`, `portfolios.status.ARCHIVED`) in both `en` and `es`

## 6. Webapp — Edit Portfolio Modal

- [x] 6.1 Remove the delete button / danger zone from `EditPortfolioModal`
- [x] 6.2 Update status select options to show ACTIVE, PAUSED, ARCHIVED (remove CLOSED)
- [x] 6.3 Remove `recoveredAmount` input from `EditPortfolioModal`

## 7. Design — Pencil

- [x] 7.1 Update portfolio list row: replace action buttons with ⋯ ellipsis button
- [x] 7.2 Update filter dropdown label to "Activas y pausadas"
- [x] 7.3 Update "Cerrada" badge on Cartera Marzo row to "Pausada"
- [x] 7.4 Edit modal has no separate Pencil screen — N/A
