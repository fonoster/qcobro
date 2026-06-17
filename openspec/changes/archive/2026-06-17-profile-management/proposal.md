## Why

The console has a "Mi perfil" entry in the user menu, but it was inert and there was no
way to view or edit your own account, or to delete it. Identity exposes `GetUser`,
`UpdateUser`, and `DeleteUser`; this change surfaces them as self-service account
management and builds the profile page already designed in `pencil.pen`.

## What Changes

- **Account procedures.** Add a `profile` router — `profile.get`, `profile.update`
  (name, phone), and `profile.delete` — each acting on the caller's own user ref from
  their token, delegating to Identity.
- **Mi perfil page.** The user-menu entry navigates to `/profile`: a General card to
  edit name/phone with a read-only email, and an "Eliminar cuenta" Danger Zone.
- **Type-to-confirm account deletion.** Deleting the account requires typing `ELIMINAR`;
  on success the session is cleared and the user returns to login.

## Capabilities

### Modified Capabilities

- `account`: Adds self-service account management — read, update (name/phone), and
  delete the caller's own account.
- `web-console`: Adds the Mi perfil page (edit name/phone, read-only email) with a
  type-to-confirm account-deletion Danger Zone, reachable from the user menu.

## Impact

- **Depends on:** `auth-and-workspaces` (authenticated context / token ref).
- **Code:** `@qcobro/common` `updateProfileSchema`; apiserver `profile` router
  (`get`/`update`/`delete`); `@fonoster/identity-client` `getUser`/`updateUser`/
  `deleteUser` (+ `User`/`UpdateUserRequest` types); webapp `Profile` page +
  `/profile` route; user-menu "Mi perfil" wired to it.
- **Design:** `pencil.pen` — "Mi perfil · Página" + the type-to-confirm dialog.
- **Out of scope:** changing email, password change from the profile page (reset flow
  already exists), avatar upload, 2FA settings.
