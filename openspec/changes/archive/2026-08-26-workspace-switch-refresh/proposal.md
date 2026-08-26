## Why

Switching the active workspace — via the sidebar `WorkspaceSwitcher` (any screen) or the workspaces
hub — doesn't update the screen the user is currently on. Root cause: the active workspace is
threaded into every tRPC call purely as a request header (`x-workspace`, read fresh from
`localStorage` at request time — `mods/webapp/src/lib/trpc.ts`), never as part of a React Query
query key. `setWorkspace` (`mods/webapp/src/lib/auth.tsx`) updates `localStorage` and context state
but never touches the query cache, so an already-mounted screen (e.g. Home, Portfolios) keeps
rendering whichever workspace's data it last fetched — a stale-data bug, and for a multi-tenant app,
a real cross-workspace data-flash risk, not just a UX nit.

## What Changes

- `setWorkspace` calls `queryClient.resetQueries()` after updating the active workspace, so every
  mounted screen drops the old workspace's cached data immediately and refetches under the new one —
  mirroring how `logout()` already clears the cache on session end.
- Covers both call sites that route through `setWorkspace`: the sidebar `WorkspaceSwitcher` and the
  workspaces hub's select/create flows.
- No apiserver or Identity changes — this is purely a webapp cache-invalidation bug.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-console`: adds a requirement that switching the active workspace refreshes whatever screen is
  currently mounted, without requiring a manual reload or navigation.

## Impact

- `mods/webapp/src/lib/auth.tsx` — `setWorkspace` resets the query cache.
- `e2e/workspace-switch-refresh.spec.ts` — new regression test: create two workspaces (one with a
  portfolio, one empty), flip between them via the sidebar switcher without navigating, assert the
  dashboard reflects each workspace's own data.
