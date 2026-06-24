## 1. Shared contract (@qcobro/common)

- [x] 1.1 Add `src/schemas/apiKeys.ts`: `apiKeyRoleEnum` (= reused `workspaceRoleEnum`: ADMIN/MEMBER), `createApiKeySchema` ({ role, expiresAt? as future epoch ms }), `apiKeyRefSchema` ({ ref })
- [x] 1.2 Output shapes flow via tRPC inference + the identity-client `ApiKey`/`ApiKeyCredentials` interfaces (mirrors `workspaces.ts`, which defines only input schemas) — secret only on create/regenerate
- [x] 1.3 Re-export from common's index; build `@qcobro/common`

## 2. Upstream identity-client wrapper (../fonoster)

- [x] 2.1 Added `createApiKey`, `listApiKeys`, `regenerateApiKey`, `deleteApiKey` + `ApiKey`/`CreateApiKeyRequest`/`ApiKeyCredentials` interfaces to `@fonoster/identity-client` (edit was NOT blocked this time)
- [x] 2.2 Rebuilt `@fonoster/identity-client` (symlinked into apiserver) — apiserver typechecks

## 3. Apiserver router

- [x] 3.1 Added `apiKeys` tRPC router (`list`, `create`, `regenerate`, `delete`) on **`adminProcedure`** (owner/admin gate built in), validating with shared schemas, proxying via `ctx.identity` + `identityCall`
- [x] 3.2 `list` returns Identity's secret-free `ApiKey[]` directly (Identity never returns secrets on list)
- [x] 3.3 Wired `apiKeys` into the root router

## 4. Webapp — Storybook-first components

- [x] 4.1 Reused existing `ui/data-table.tsx` for the keys list (no new table component) — composed in the page with copy/role/expiry/created cells + row actions
- [x] 4.2 `CreateApiKeyDialog` component + story (role select, optional expiry date)
- [x] 4.3 `ShowSecretDialog` component + story (one-time secret display, copy-to-clipboard, store-now warning)
- [x] 4.4 Regenerate confirm via existing `ui/dialog.tsx` (warns old secret stops working); delete via existing `ui/confirm-delete-dialog.tsx` (type-to-confirm)

## 5. Webapp — page + wiring

- [x] 5.1 `ApiKeys` page composing the components against `trpc.apiKeys.*`; secret held in local state, discarded on dialog close
- [x] 5.2 Owner/admin gate via shared `lib/workspaceRole.ts` (`isWorkspaceAdmin`); also refactored WorkspaceSettings to reuse it
- [x] 5.3 Added `/api-keys` route in `App.tsx` and a "Claves de API" item in `UserMenu` (rendered only for owner/admin)
- [x] 5.4 Added i18n messages (en + es) for all user-facing text; new `common.cancel` key

## 6. Tests

- [x] 6.1 `mods/common/src/schemas/apiKeys.test.ts` — valid create (default member, future expiry) + validation-failure cases (owner role rejected, past expiry rejected) + ref schema (5 tests, pass)
- [x] 6.2 `mods/apiserver/src/trpc/routers/apiKeys.test.ts` — createCaller with stubbed identity: list omits secret, create forwards role/expiry + returns secret, **invalid input rejects with NO identity call**, delete forwards ref, non-admin member is FORBIDDEN (5 tests, pass)
- [x] 6.3 `e2e/api-keys.spec.ts` written (owner create → secret-once → regenerate → delete golden path). Workflow VERIFIED end-to-end against the live stack via a throwaway capture spec (API-seeded session, since the shared `signUpAndEnter` helper has a pre-existing post-create token-claims race that bounces ALL specs to the picker). Screenshots 01–07 captured; create/list/regenerate/delete all work live. `api-keys.spec.ts` itself inherits the shared-helper blocker until that's fixed centrally.

  Live verification found + fixed two real bugs: (a) Identity only permits `WORKSPACE_ADMIN` for keys (its `createApiKeyRequestSchema` is `z.enum([WORKSPACE_ADMIN])`) → corrected `apiKeyRoleEnum`, the create dialog (no role picker), schema/spec/tests; (b) `apiKeys.list` returns a garbage/negative `createdAt` from Identity (gRPC timestamp serialization — workspaces serialize fine) → `fmtDate` now degrades implausible dates to "—". The Identity createdAt issue is upstream and worth filing.

## 7. Gates

- [x] 7.1 `typecheck` (4/4) + `lint` clean + `test` (3 projects, incl. new 10 tests) green. E2E unverified (see 6.3).
- [x] 7.2 `openspec validate api-keys` passes
