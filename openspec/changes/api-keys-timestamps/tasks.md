## 1. Local upstream dependency

- [ ] 1.1 Build the fixed `@fonoster/identity` / `@fonoster/identity-client` from the local
      `fonoster/fonoster` worktree (branch `fix/apikey-timestamp-units`).
- [ ] 1.2 Make the local dev stack use the built fix (without changing qcobro's declared
      dependency version) so the feature can be verified end to end.

## 2. Design (Pencil)

- [ ] 2.1 Re-add the "Creada" column to the Claves de API page table in pencil.pen.
- [ ] 2.2 Re-add the expiry field to the Crear modal in pencil.pen.
- [ ] 2.3 Confirm with the user that the design looks right.

## 3. Spec reconcile

- [ ] 3.1 Confirm the delta spec (`specs/api-keys/spec.md` in this change) matches the final
      design; update if the design iteration changed anything.
- [ ] 3.2 `openspec validate api-keys-timestamps`.

## 4. Build

- [ ] 4.1 apiserver: convert `expiresAt` ms → seconds in `mods/apiserver/src/trpc/routers/apiKeys.ts`
      before calling `ctx.identity.createApiKey`.
- [ ] 4.2 webapp: add `createdAt` to `ApiKeys.tsx`'s `Row` type, the `list.data.items` mapping, and a
      new `DataTable` column (reuse `fmtDate`).
- [ ] 4.3 webapp: add an expiry input to `CreateApiKeyDialog.tsx`, wired to `input.expiresAt`; remove
      the outdated comment explaining why it was omitted.
- [ ] 4.4 typecheck + lint clean.

## 5. Test

- [ ] 5.1 Unit: apiserver test asserting the ms→seconds conversion at the create boundary.
- [ ] 5.2 E2E / live verification: create a key with an expiry, confirm it lists correctly with both
      createdAt and expiresAt showing real (non-garbage) dates; create a key without an expiry,
      confirm "no expiry" still renders correctly.
- [ ] 5.3 lint + typecheck + test all green.

## 6. Sync — gate first

- [ ] 6.1 Promote the delta spec into `openspec/specs/api-keys/spec.md`.

## 7. Archive — gate first

- [ ] 7.1 Archive the change.
