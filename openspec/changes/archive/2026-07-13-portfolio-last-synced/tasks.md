## 1. Design (Pencil)

- [x] 1.1 Open the portfolio list frame in Pencil and reconcile it against the shipped table in `mods/webapp/src/pages/Portfolios.tsx` — add any columns/actions already implemented in code but missing from the design (do not redesign columns already covered). Found the design's "Sincronizado" date column already modeled last-synced; added the missing `clientId` (as the Name cell's sub-line) and `totalOutstandingBalance`/`recoveredAmount` columns to match shipped code.
- [x] 1.2 Confirmed the existing "Sincronizado" column already covers the last-synced display; no new column needed for it (a "Never synced" placeholder still needs to be wired in the webapp implementation).

## 2. Data model

- [x] 2.1 Add `lastSyncedAt DateTime?` to the `Portfolio` model in `mods/apiserver/prisma/schema.prisma`.
- [x] 2.2 Generate and commit the Prisma migration (`20260713031839_portfolio_last_synced`).

## 3. Shared types

- [x] 3.1 Add `lastSyncedAt: Date | null` to `PortfolioRecord` in `mods/common/src/types/portfolios.ts` (also excluded it from the `create()` input, defaulting to unset like `accountCount`/`recoveredAmount`).

## 4. Apiserver

- [x] 4.1 In `mods/apiserver/src/functions/portfolios/syncAccounts.ts`, set `lastSyncedAt: new Date()` in the `tx.portfolio.update` call alongside `accountCount`/`totalOutstandingBalance`.
- [x] 4.2 Updated `syncAccounts.test.ts` to assert `lastSyncedAt` is stamped on sync completion, and that it stays unset when the validation-failure case (empty rows) rejects before any write.
- [x] 4.3 Confirmed `portfolios.list`/`portfolios.get` (`mods/apiserver/src/trpc/routers/portfolios.ts`) call `ctx.prisma.portfolio.findMany`/`findFirstOrThrow` directly with no field projection, so `lastSyncedAt` flows through once present on the Prisma model — no router change needed.

## 5. Webapp

- [x] 5.1 Add `lastSyncedAt` to the `Portfolio` type in `mods/webapp/src/pages/Portfolios.tsx`.
- [x] 5.2 Add a "last synced" column to the `DataTable` `columns` array, rendering a localized date via the i18n layer, or the i18n "Never synced" string when `null`.
- [x] 5.3 Add the new i18n keys (`portfolios.col.lastSynced`, `portfolios.lastSynced.never`) to both `en` and `es` resource blocks.

## 6. Tests

- [x] 6.1 Unit test for `createSyncAccounts` covering the validation-failure case (unchanged behavior) plus the new `lastSyncedAt` stamping assertion.
- [x] 6.2 E2E: added `e2e/portfolio-last-synced.spec.ts` covering the portfolio list golden path — "Nunca sincronizada" before a sync, replaced by a timestamp after a CSV sync via the list's row action.

## 7. Verification

- [x] 7.1 Ran lint, typecheck, and test suites (unit + full e2e suite of 20 specs); all green.
