## Why

`workspace-management` shipped rename but explicitly deferred deletion. Owners now
need a way to permanently remove a workspace they no longer use. Identity already
exposes `DeleteWorkspace`; this change surfaces it through the apiserver and adds an
owner-only Danger Zone to the Workspace Configuration page, guarded by a
type-to-confirm dialog so the irreversible action can't be triggered by accident.

## What Changes

- **Delete a workspace.** Add a `workspaces.delete` procedure restricted to the
  workspace **owner** (not admins), delegating to Identity's `DeleteWorkspace`.
- **Danger Zone on the configuration page.** Owners see an "Eliminar espacio" card
  below General. Admins and members do not.
- **Type-to-confirm.** Deleting requires typing `ELIMINAR` to enable the destructive
  button; on success the console leaves the deleted workspace and re-selects another
  (or routes to workspace creation when none remain).

## Capabilities

### Modified Capabilities

- `workspaces`: Adds workspace **deletion**, restricted to the workspace owner.
- `web-console`: Adds an owner-only **Danger Zone** to the Workspace Configuration
  page with a **type-to-confirm** delete dialog and post-delete navigation.

## Impact

- **Depends on:** `auth-and-workspaces` and `workspace-management` (this change adds to
  the `workspaces` and `web-console` capabilities they introduce).
- **Code:** `@qcobro/common` `deleteWorkspaceSchema`; apiserver `ownerProcedure` +
  `workspaces.delete`; `@fonoster/identity-client` `deleteWorkspace`; webapp Danger Zone
  card + type-to-confirm dialog on the configuration page; owner gating from the access
  token's per-workspace role.
- **Design:** `pencil.pen` — Danger Zone card on "Configuración del espacio · Página"
  and the "Confirmar · Eliminar (escribe para confirmar)" dialog.
- **Out of scope:** ownership transfer, soft-delete/restore, account deletion.
