## Why

Two settings live in the wrong place. **Currency** is per-`Portfolio` (`Portfolio.currency`
USD/DOP), so a workspace that bills/reports in one currency can end up with mixed-currency
carteras, and the dashboard sums them incoherently. **Timezone** is deployment-wide in
`qcobro.json`, so every workspace in a deployment is forced to share one zone (the campaigns
spec already notes per-workspace timezones as deferred).

Both are workspace-level concerns. Workspaces live in Fonoster Identity, which we do **not**
want to touch. The clean pattern: the app owns app-settings keyed by the Identity
`workspaceRef`. This change introduces that store and moves currency and timezone into it.

## What Changes

- **New per-workspace settings store** in the apiserver's own Postgres — a `WorkspaceSettings`
  record keyed by `workspaceRef` (currency + timezone, room to grow). No Identity changes.
- **Currency becomes a workspace setting.**
  - **BREAKING:** remove `Portfolio.currency`; remove the currency picker from portfolio
    create/edit; remove currency from the CSV sync path and the portfolio-create input.
  - All currency display (dashboard money, portfolio list/detail, payment-promise amounts)
    formats using the workspace currency.
- **Timezone becomes a workspace setting.**
  - The engine's wall-clock logic (campaign outreach window, `reserveAttempt` daily-cap
    reset) reads the **workspace** timezone via the tRPC context instead of the global value.
  - `qcobro.json → apiserver.timezone` is demoted to a **default/fallback** used to seed a
    workspace's setting when none exists — no longer the per-workspace source of truth.
- **Settings UI:** the existing "Configuración del espacio" page gains **Currency** and
  **Timezone** fields, read/written through a new `workspaceSettings` tRPC router (i18n for
  all labels).
- **Defaults & migration:** a `WorkspaceSettings` row is upserted with defaults (currency
  `USD`, timezone = the `qcobro.json` default) when missing; the migration drops
  `Portfolio.currency` and backfills each workspace's currency from its existing portfolios
  when uniform, else `USD`.

## Capabilities

### New Capabilities

- `workspace-settings`: the per-workspace settings record (currency, timezone) keyed by
  `workspaceRef`, its read/update operations, and default/seed behavior — stored in the app
  DB, never in Identity.

### Modified Capabilities

- `campaigns`: campaign wall-clock times are interpreted in the **workspace's** timezone
  (from `WorkspaceSettings`), not the deployment-wide `qcobro.json` value.
- `web-console`: the workspace settings page gains Currency + Timezone controls; the
  portfolio create/edit form no longer has a currency field.
- `sdk-portfolios`: `portfolios.create` no longer accepts a `currency` argument.
- `channel-dispatch`: the `{{currency}}` template variable resolves from the workspace
  setting, not the owning portfolio.

## Impact

- **`mods/common`**: `WorkspaceSettings` schema/types + client interface; remove `currency`
  from portfolio create/sync schemas; keep the `Currency` enum (now workspace-scoped).
- **`mods/apiserver`**: `WorkspaceSettings` Prisma model + migration (drop `Portfolio.currency`,
  backfill); `workspaceSettings` router + validated functions; resolve per-workspace timezone
  (and currency) in the tRPC context and engine; drop currency from portfolio create/sync.
- **`mods/webapp`**: Currency + Timezone fields on "Configuración del espacio"; remove
  currency from portfolio forms; currency-aware formatting on dashboard/portfolios/promises;
  i18n.
- **Pencil**: "Configuración del espacio · Página" gains the two fields.
- **Config**: `qcobro.json → apiserver.timezone` documented as the default/seed only.
