# Collect currency + timezone at workspace creation

## Why

Workspace currency and timezone live in `WorkspaceSettings` (keyed by `workspaceRef`),
currently populated lazily via seed-on-read with column defaults (`USD`,
`America/Costa_Rica`). That means a brand-new workspace silently inherits defaults the owner
may not notice — currency in particular drives all money display. The create-workspace form
already collects a name (and a region); it should also let the owner choose currency and
timezone so the workspace is configured correctly from the start.

## What Changes

- The create-workspace form collects **currency** (`USD` | `DOP`) and **timezone** (IANA),
  alongside the existing name.
- `workspaces.create` writes the `WorkspaceSettings` row for the new workspace with the
  chosen values (the app owns app-settings; Identity is still not touched).
- Seed-on-read + the column defaults are **kept** as a backstop, so a workspace created by
  any other path (SDK, invite acceptance, seed script) still always resolves settings.

## Impact

- Specs: `web-console` (create-workspace collects currency + timezone), `workspace-settings`
  (settings are written at creation, defaults remain the backstop).
- Code: `@qcobro/common` (`createWorkspaceSchema` gains currency + timezone), `apiserver`
  (`workspaces.create` writes the settings row), `webapp` (create-workspace form fields).
- Pencil: "Crear espacio · Modal" gains Moneda + Zona horaria selects.
