## Why

Now that accounts, workspaces, and membership exist (`auth-and-workspaces`), the console needs the everyday navigation and workspace-administration surfaces that make multi-tenancy usable: a way back to the list of workspaces, a user menu that reaches account and workspace settings, and a place to rename a workspace. These were intentionally deferred from `auth-and-workspaces` (which shipped workspace create/list/get and the Members page, but left `update` and the console wiring out). All surfaces here are designed in `pencil.pen`.

## What Changes

- **Rename a workspace.** Implement the deferred `workspaces.update` procedure (owner/admin only) and a **Workspace Configuration page** scoped, for now, to changing the workspace name.
- **User menu off the avatar.** The sidebar profile opens a menu with exactly: Mi perfil, Configuración del espacio (→ config page), Miembros (→ members page), Cerrar sesión. This makes the Members page reachable (it previously had no navigation entry) and replaces the placeholder account links.
- **Logo returns to the workspace list.** Clicking the brand logo navigates to the workspace list ("choose a workspace") screen — a consistent way out of a workspace.
- **Workspace list refinements.** Show at most three workspace cards plus the "New workspace" card; each card carries a gear (bottom-right) linking to that workspace's configuration. Drop the "active" badge — the current workspace is simply the one in context.

## Capabilities

### Modified Capabilities

- `workspaces`: Adds workspace **rename** (the `update` operation deferred in `auth-and-workspaces`), restricted to owner/admin.
- `web-console`: Adds the avatar **user menu** (account + workspace actions), **logo → workspace list** navigation, the **Workspace Configuration page** (rename), and **workspace-list** presentation rules (≤3 cards, gear → config, no active badge).

## Impact

- **Depends on:** `auth-and-workspaces` being archived first (this change modifies the `workspaces` and `web-console` capabilities it introduces).
- **Code:** apiserver `workspaces.update`; webapp — user-menu component, Workspace Configuration page + route, logo link, workspace-list card/limit changes; i18n keys for new copy.
- **Design:** designed in `pencil.pen` — User Menu (4 entries), Workspace Card (bottom-right gear, no active badge), Workspace list, Configuration page.
- **Carried from verification (separate follow-ups, not in this change):** (a) Gestiones recientes activity icons should be toned to the muted chip the design uses; (b) the containerized Identity service can't read `qcobro.json` (Dockerfile/compose env-vars vs config-via-json mismatch) — reconcile before relying on the container.
- **Out of scope:** workspace deletion, ownership transfer, richer workspace settings beyond rename, account/profile page contents.
