## Context

Portfolios currently have a two-value status (`ACTIVE`, `CLOSED`) stored as a Prisma enum.
The list page shows all portfolios with individual per-row buttons for CSV sync, edit, and
delete. Delete lives inside the edit modal, which is an unusual and somewhat risky placement.

This change introduces a three-value status, adjusts the default query, adds a reusable
`RowActionsMenu` component, and removes delete from the edit modal.

## Goals / Non-Goals

**Goals:**

- Replace `CLOSED` with `PAUSED` + `ARCHIVED` at DB, schema, and UI layers
- Default list query returns ACTIVE + PAUSED; ARCHIVED requires explicit filter
- Single `RowActionsMenu` component usable across list pages (portfolios, future members refactor)
- Delete moved exclusively to the ellipsis menu, away from the edit modal

**Non-Goals:**

- Bulk archive/delete
- Undo for archived portfolios
- Migrating the Members page ellipsis to this new component (separate change)

## Decisions

### 1. Prisma enum migration strategy

`PortfolioStatus` enum changes from `[ACTIVE, CLOSED]` to `[ACTIVE, PAUSED, ARCHIVED]`.
Existing `CLOSED` rows must be migrated. We'll rename `CLOSED → ARCHIVED` via a two-step
Prisma migration: add new values, backfill, remove old value.

**Alternative considered:** Add a separate `archivedAt` timestamp field.
**Rejected:** Over-engineers a simple state machine; the enum is sufficient and matches how
status is already filtered and displayed.

### 2. Default filter as a query param default, not middleware

The `list` tRPC procedure defaults its `status` param to `["ACTIVE", "PAUSED"]` when
omitted, rather than filtering in a middleware or view layer. This keeps the API honest —
callers that pass an explicit status always get exactly what they asked for.

### 3. RowActionsMenu as a generic `<button>` + portal dropdown

A reusable `RowActionsMenu` component renders a ⋯ trigger `<button>` and a positioned
dropdown via a `useClickOutside` hook. Items are passed as `{ label, onClick, variant? }`
props. The destructive Eliminar item uses `variant: "destructive"` to render in red.
No external library needed — a simple absolute-positioned div suffices at this scale.

**Alternative considered:** Radix UI DropdownMenu.
**Tradeoff:** Would be more robust for a11y/animation, but adds a dependency. Acceptable
to hand-roll given the product's current scale; can migrate later.

### 4. Delete removed from EditPortfolioModal

Delete moves entirely to the ellipsis menu's Eliminar item, which triggers the existing
`ConfirmDeleteDialog`. The `ConfirmDeleteDialog` component is already generic and requires
no changes. The edit modal simply loses its danger-zone `<Button variant="destructive">`.

## Risks / Trade-offs

- **Migration risk**: Existing `CLOSED` rows become `ARCHIVED`. If any integration or
  external system references `CLOSED`, it will break. → Mitigation: only internal use today.
- **Client-side filter UX**: If there are many ACTIVE/PAUSED portfolios and the user
  forgets ARCHIVED exist, they may think data is missing. → Mitigation: the filter dropdown
  clearly labels the "Archivadas" option.

## Migration Plan

1. Update Prisma schema: add `PAUSED`, `ARCHIVED`; keep `CLOSED` temporarily
2. Generate migration — adds new enum values
3. Add a second migration to backfill: `UPDATE "Portfolio" SET status = 'ARCHIVED' WHERE status = 'CLOSED'`
4. Generate third migration to remove `CLOSED` from enum
5. Update Zod schema in `@qcobro/common`
6. Update tRPC `list` procedure default
7. Update webapp filter select and i18n strings
8. Add `RowActionsMenu` component; wire up in `Portfolios.tsx`
9. Remove delete button from `EditPortfolioModal`
10. Update Pencil design file

## Open Questions

- None — scope is well-defined and contained to the portfolios feature.
