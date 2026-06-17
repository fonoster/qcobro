## 1. Identity client (Fonoster)

- [x] 1.1 Add `getUser(ref, token)`, `updateUser(request, token)`, `deleteUser(ref, token)` to `@fonoster/identity-client` (+ `User`/`UpdateUserRequest` types)

## 2. Account procedures (apiserver)

- [x] 2.1 Add `updateProfileSchema` (name, phone) to `@qcobro/common`
- [x] 2.2 Add a `profile` router — `get`/`update`/`delete` acting on `ctx.user.ref`
- [x] 2.3 Register `profile` in the app router

## 3. Mi perfil page (webapp)

- [x] 3.1 Add a `Profile` page + `/profile` route (under the authed layout)
- [x] 3.2 General card: edit name/phone, read-only email; save via `profile.update`
- [x] 3.3 Danger Zone: type-to-confirm `ELIMINAR` → `profile.delete` → logout → login
- [x] 3.4 Wire the user-menu "Mi perfil" entry to `/profile`

## 4. Design (Pencil)

- [x] 4.1 "Mi perfil · Página" (General + read-only email + Eliminar cuenta Danger Zone)

## 5. Verification

- [x] 5.1 `npm run build`, `typecheck`, `lint` pass (common, apiserver, webapp)
- [x] 5.2 e2e: `e2e/profile.spec.ts` (open profile, edit + save, account deletion via type-to-confirm)
- [x] 5.3 Run e2e green — pending a published `@fonoster/identity-client` with the user methods (CI `npm ci` resolves it)
