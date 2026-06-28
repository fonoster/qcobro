## Context

The page at `/create-workspace` is really a **workspace hub**: it lists the user's
workspaces as cards (each with a settings gear) and offers a "new workspace" action. Today
the console drops a freshly logged-in user straight into one workspace's dashboard, and only
sends them to the hub when they have zero workspaces. On the hub the avatar is a static
circle, so a user with no workspace is trapped — there is no log out and no way to reach
their account (issue #9).

`/profile` is account-level (it only reads/writes `profile.*` — name, phone, language,
account deletion; no workspace needed) but is currently a nested route under
`AuthedLayout`, which redirects zero-workspace users to the hub before they can reach it.

The in-app sidebar already has a `UserMenu` dropdown (Profile, Workspace Settings, Members,
API Keys, Log out) and a standalone `LanguageSwitcher` component with a story. These are the
building blocks to reuse.

## Goals / Non-Goals

**Goals:**

- Land authenticated users on the workspaces hub at `/workspaces` (renamed from
  `/create-workspace`); selecting a workspace still enters its dashboard.
- Give the hub avatar a dropdown with: account header (name + email), Profile link, language
  switcher, and Log out — so a trapped user always has a way out.
- Make `/profile` reachable without an active workspace.

**Non-Goals:**

- No changes to API, schemas, or the database.
- No changes to the in-app sidebar `UserMenu` beyond what reuse requires.
- No redesign of the hub cards or the create-workspace modal.
- Workspace-scoped actions (Settings, Members, API Keys) stay out of the hub account menu —
  they need an active workspace and each card already exposes its own settings gear.

## Decisions

### Account-level shell for the hub and profile

Introduce a thin **account-level layout** (header with the logo + the account menu) that
wraps the account-scoped routes `/workspaces` and `/profile`, rendered under `RequireAuth`
but **outside** `AuthedLayout` (which requires a workspace). This makes `/profile` reachable
with no workspace and puts the account menu in one place for both pages.

- _Alternative considered:_ duplicate a header into both `Workspaces` and `Profile`. Rejected
  — two copies of the same chrome and menu wiring drift apart.
- _Alternative considered:_ keep `/profile` under `AuthedLayout` and only show the Profile
  link when the user has a workspace. Rejected — inconsistent for new users, and the spec now
  requires profile to be reachable without a workspace.

### Reuse `UserMenu` rather than fork it

The hub account menu is the same dropdown as the sidebar `UserMenu`, minus the
workspace-scoped items and dropping **downward** from a top-right avatar instead of upward
from the sidebar. Factor the shared dropdown so both placements and both item sets are
supported (e.g. a placement prop + the ability to omit workspace-scoped items), reusing the
existing `LanguageSwitcher` and the established i18n keys (`userMenu.logout`, `profile.title`,
`userMenu.aria`, …). Avoid a second copy of the portal/positioning logic.

### Route rename and post-auth targets

`/create-workspace` → `/workspaces`; the `CreateWorkspace` page becomes `Workspaces`. All
post-auth navigations target the hub: login, contact verify + skip, and the `AuthedLayout`
zero-workspace redirect. Selecting/creating a workspace continues to navigate to `/` (the
workspace dashboard). e2e helpers/specs that assert the post-auth and post-delete URL move
from `/create-workspace` to `/workspaces`.

## Risks / Trade-offs

- **In-app Profile now leaves the app shell** → Opening Profile from the sidebar lands on the
  account-level page without the sidebar. Mitigation: the account-level header logo links back
  to `/workspaces`; Profile is genuinely account-scoped, so a separate context is acceptable
  and matches common "account settings" patterns.
- **Language reconciliation lived in `AuthedLayout`** → the hub/profile render outside it.
  Mitigation: the language switcher and Profile both call `setLanguage` directly and the user
  language preference is persisted to the profile, so behavior is unchanged off the app shell.
- **Extra click for single-workspace users** → they now see the hub instead of going straight
  to their dashboard. Accepted: this was the explicit product decision (always show the list).
