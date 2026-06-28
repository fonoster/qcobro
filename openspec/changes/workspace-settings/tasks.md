## 1. Shared contracts (`mods/common`)

- [x] 1.1 Add `WorkspaceSettings` Zod schema + types (workspaceRef, currency, timezone) and an `updateWorkspaceSettings` input schema (currency enum + non-empty IANA timezone)
- [x] 1.2 Add the `WorkspaceSettings` client interface methods to the relevant client type(s) (findUnique/upsert/update)
- [x] 1.3 Remove `currency` from the portfolio create + sync input schemas; keep the `Currency` enum
- [x] 1.4 Add a `currency` field to the dispatch/outreach context shape (sourced from the workspace, not the portfolio)

## 2. Data model & migration (`mods/apiserver`)

- [x] 2.1 Add `WorkspaceSettings` Prisma model (`workspaceRef @id`, `currency Currency @default(USD)`, `timezone String`, timestamps)
- [x] 2.2 Migration: create `workspace_settings`; backfill one row per distinct `workspaceRef` (currency = uniform portfolio currency else `USD`, timezone = configured default)
- [x] 2.3 Migration: drop `Portfolio.currency` (after backfill)

## 3. Settings resolution & API (`mods/apiserver`)

- [x] 3.1 `workspaceSettings` validated functions: `get` (seed-on-read default row when missing) and `update`
- [x] 3.2 `workspaceSettings` tRPC router (get/update), workspace-scoped
- [x] 3.3 Resolve the active workspace's settings in the tRPC context: expose `ctx.timezone` + `ctx.currency` from `WorkspaceSettings` (fallback to `qcobro.json` default), replacing the global timezone source
- [x] 3.4 Engine: `reserveAttempt` daily-cap reset and campaign outreach-window logic read the per-workspace timezone
- [x] 3.5 Dispatch context: `{{currency}}` resolves from the workspace currency, not the owning portfolio
- [x] 3.6 Remove `currency` from portfolio create + `syncAccounts`

## 4. Webapp (`mods/webapp`)

- [x] 4.1 "Configuración del espacio": add Currency (USD/DOP) + Timezone fields wired to `workspaceSettings.get`/`update`
- [x] 4.2 Remove the currency field from the portfolio create/edit form
- [x] 4.3 Currency-aware money formatting: fetch the workspace currency and use it on dashboard, portfolio list/detail, payment-promise amounts (replace hardcoded `USD`)
- [x] 4.4 i18n strings for the new settings fields (no hardcoded literals)

## 5. Config

- [x] 5.1 Document `qcobro.json → apiserver.timezone` as the default/seed only; update `qcobro.example.json`/`qcobro-prod.json` notes

## 6. Tests

- [x] 6.1 Unit (sinon): `workspaceSettings` get seeds a default row when missing; update validates currency/timezone (validation-failure case)
- [x] 6.2 Unit: dispatch context renders `{{currency}}` from the workspace currency; portfolio create/sync no longer accept currency
- [x] 6.3 Unit: context/engine resolves per-workspace timezone (falls back to default when unset)
- [ ] 6.4 E2E: set workspace currency + timezone in Configuración del espacio; dashboard money reflects the new currency; portfolio form has no currency field
