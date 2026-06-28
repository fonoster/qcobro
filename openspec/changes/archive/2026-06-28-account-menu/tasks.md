## 1. Routing & post-auth landing

- [x] 1.1 Rename route `/create-workspace` → `/workspaces`; rename `CreateWorkspace` page/file to `Workspaces`
- [x] 1.2 Land users on `/workspaces` after login
- [x] 1.3 Land users on `/workspaces` after contact verification and after skipping it
- [x] 1.4 Point `AuthedLayout` zero-workspace redirect and the sidebar logo link to `/workspaces`

## 2. Account-level shell & menu

- [x] 2.1 Factor the shared dropdown out of `UserMenu` (new `menu.tsx`: MenuPanel/MenuHeader/MenuDivider/MenuItem); refactor `UserMenu` to use it; new `AccountMenu` drops downward and adds a language switcher (persisted to the profile)
- [x] 2.2 Create an account-level layout (`AccountLayout`: logo + account menu) rendered under `RequireAuth` but outside `AuthedLayout`
- [x] 2.3 Render the account menu on the workspaces-hub avatar: account header (name + email), Profile link, language switcher, Log out

## 3. Profile promoted to account-level

- [x] 3.1 Move `/profile` to an account-level route (under `AccountLayout`, outside `AuthedLayout`) so it is reachable with no active workspace
- [x] 3.2 In-app sidebar `UserMenu` Profile link still navigates to `/profile`; account-level header logo returns to `/workspaces`

## 4. Tests & checks

- [x] 4.1 e2e: update helpers/specs that assert the post-auth and post-delete URL to `/workspaces`
- [x] 4.2 e2e golden path: from the workspaces hub, open the account menu and log out → returns to login
- [x] 4.3 e2e: a zero-workspace user opens Profile from the account menu (reachable without a workspace)
- [x] 4.4 Storybook: a story for the account-menu dropdown (`menu.stories.tsx`)
- [x] 4.5 Run lint, typecheck, and e2e — all green (no validated functions added, so no unit test required)

## 5. Sync & archive

- [x] 5.1 Sync the delta into the main `web-console` spec (human gate)
- [x] 5.2 Archive the change (human gate)
