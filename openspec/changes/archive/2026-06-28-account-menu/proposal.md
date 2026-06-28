## Why

A user who lands on the workspace hub with no workspace (a brand-new account, or after
deleting their last workspace) is trapped: the page only lets them create a workspace, with
no way to log out or reach their account — see issue #9. At the same time the page is
misnamed `/create-workspace` even though it lists existing workspaces, and freshly
logged-in users are dropped straight into a single workspace's dashboard rather than seeing
their workspaces.

## What Changes

- **Post-login landing**: after login — and after contact verification or skipping it, and
  after deleting the last workspace — operators land on the workspaces hub, not directly in a
  workspace dashboard. Selecting a workspace card still enters that workspace.
- **Route rename**: `/create-workspace` → `/workspaces`, reflecting that the page lists
  existing workspaces and offers creation.
- **Account menu on the hub**: the avatar on the workspaces hub opens a dropdown with an
  account header (name + email), a **Profile** link, a **language switcher**, and **Log
  out**. This gives the trapped user a way out (fixes issue #9).
- **Profile reachable account-wide**: `/profile` becomes an account-level route reachable
  without an active workspace, so a zero-workspace user can open it from the account menu.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `web-console`: post-login (and post-verification / post-last-workspace-deletion) routing
  lands on the workspaces hub; the hub is served at `/workspaces`; the hub exposes an account
  menu (account header, Profile, language switcher, Log out); `/profile` is reachable without
  an active workspace.

## Impact

- **webapp routing**: `/create-workspace` → `/workspaces`; `/profile` promoted out of the
  workspace-gated `AuthedLayout` to an account-level route; post-auth `navigate` targets.
- **webapp components**: `CreateWorkspace` page renamed to `Workspaces`; a reusable account
  menu/dropdown shared by the hub (reusing the existing `UserMenu` pattern and
  `LanguageSwitcher`); `AuthedLayout` zero-workspace redirect target.
- **e2e**: helpers and specs that assert the post-auth / post-delete URL.
- No API, schema, or database changes.
