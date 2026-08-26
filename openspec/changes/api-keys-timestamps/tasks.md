## 1. Local upstream dependency

- [x] 1.1 Build the fixed `@fonoster/identity` / `@fonoster/identity-client` from the local
      `fonoster/fonoster` worktree (branch `fix/apikey-timestamp-units`). Built as a Docker image
      `fonoster/identity:local-apikey-ts-fix` from the identity module's own Dockerfile.
- [x] 1.2 Make the local dev stack use the built fix (without changing qcobro's declared
      dependency version) so the feature can be verified end to end. Swapped the running
      `qcobro-identity-1` container to the local image via a compose override, verified live,
      then reverted to the pinned `fonoster/identity:0.22.0` afterward.

## 2. Design (Pencil)

- [x] 2.1 Re-add the "Creada" column to the Claves de API page table in pencil.pen.
- [x] 2.2 Re-add the expiry field to the Crear modal in pencil.pen.
- [x] 2.3 Confirm with the user that the design looks right. Also moved Creada to sit next to
      Expira as the last two columns per user feedback.

## 3. Spec reconcile

- [x] 3.1 Confirm the delta spec (`specs/api-keys/spec.md` in this change) matches the final
      design; update if the design iteration changed anything. Column order is a layout detail,
      not spec-level — no changes needed.
- [x] 3.2 `openspec validate api-keys-timestamps`.

## 4. Build

- [x] 4.1 apiserver: convert `expiresAt` ms → seconds in `mods/apiserver/src/trpc/routers/apiKeys.ts`
      before calling `ctx.identity.createApiKey`.
- [x] 4.2 webapp: add `createdAt` to `ApiKeys.tsx`'s `Row` type, the `list.data.items` mapping, and a
      new `DataTable` column (reuse `fmtDate`).
- [x] 4.3 webapp: add an expiry input to `CreateApiKeyDialog.tsx`, wired to `input.expiresAt`; remove
      the outdated comment explaining why it was omitted.
- [x] 4.4 typecheck + lint clean.

## 5. Test

- [x] 5.1 Unit: apiserver test asserting the ms→seconds conversion at the create boundary (plus a
      no-expiry case). 6/6 apiKeys router tests green.
- [x] 5.2 E2E / live verification: created a key with an expiry via the real running app (fresh
      signup, fresh workspace, against the swapped-in fixed identity), confirmed Creada=8/25/2026
      and Vence=12/30/2026 rendered correctly (no garbage/1970 dates); created a second key with
      no expiry, confirmed "Sin vencimiento" renders; deleted both test keys afterward.
- [x] 5.3 lint + typecheck + test all green.

## 6. Sync — gate first

- [ ] 6.1 Promote the delta spec into `openspec/specs/api-keys/spec.md`.

## 7. Archive — gate first

- [ ] 7.1 Archive the change.
