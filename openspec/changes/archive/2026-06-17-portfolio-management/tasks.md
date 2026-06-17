## 1. Common — Schemas and Types

- [x] 1.1 Add `createPortfolioSchema` and `updatePortfolioSchema` Zod schemas to `mods/common/src/schemas/`; export from the package index
- [x] 1.2 Add `AccountRowSchema` (all CSV fields) and `syncAccountsInputSchema` (portfolioId + mode + rows) to `mods/common/src/schemas/`; export from the package index
- [x] 1.3 Add `PortfolioClient` interface (wrapping the Prisma portfolio/account operations needed by validated functions) to `mods/common/src/types/`; export from the package index

## 2. Database

- [x] 2.1 Add `Portfolio` model to `mods/apiserver/prisma/schema.prisma` with fields: `id`, `workspaceRef`, `name`, `clientId`, `accountCount` (Int), `totalOutstandingBalance` (Float), `recoveredAmount` (Float), `status` (String, default ACTIVE), `createdAt`, `updatedAt`; add `PortfolioAccount` relation
- [x] 2.2 Add `PortfolioAccount` model with all CSV-mapped fields (see spec table), `archivedAt DateTime?` for soft-delete, `portfolioId` FK with cascade delete, and a `@@unique([portfolioId, externalId])` constraint
- [x] 2.3 Run `prisma migrate dev --name add-portfolios` to generate and apply the migration

## 3. Validated Functions

- [x] 3.1 Implement `createCreatePortfolio(client: PortfolioClient)` validated function in `mods/apiserver/src/functions/portfolios/` using `createPortfolioSchema`
- [x] 3.2 Implement `createUpdatePortfolio(client: PortfolioClient)` validated function using `updatePortfolioSchema`
- [x] 3.3 Implement `createDeletePortfolio(client: PortfolioClient)` validated function (accepts `{ id }`, hard-deletes portfolio and cascades to accounts)
- [x] 3.4 Implement `createSyncAccounts(client: PortfolioClient)` validated function using `syncAccountsInputSchema`; in REPLACE mode soft-archive absent accounts (`archivedAt = now()`) and un-archive returning ones (`archivedAt = null`); recompute stats over `archivedAt IS NULL` rows; all mutations run inside a single Prisma transaction; returns `{ created, updated, archived, total }`

## 4. tRPC Router

- [x] 4.1 Create `portfoliosRouter` in `mods/apiserver/src/trpc/routers/portfolios.ts` with `list` (workspace-scoped, optional status filter) and `get` (workspace-scoped, includes campaigns) procedures
- [x] 4.2 Add `create`, `update`, `delete` procedures to `portfoliosRouter` delegating to the validated functions from task 3
- [x] 4.3 Add `listAccounts` procedure: paginated query on `PortfolioAccount` filtered by `portfolioId` and `archivedAt IS NULL`, ordered by `fullName` asc, returning `{ items, total }`
- [x] 4.4 Add `syncAccounts` procedure delegating to the `createSyncAccounts` validated function
- [x] 4.5 Register `portfoliosRouter` in the app router (`mods/apiserver/src/trpc/router.ts`) and add `ctx.prisma` wiring

## 5. Webapp — CSV Utility and i18n

- [x] 5.1 Create `mods/webapp/src/lib/csv.ts` with `parseCsv(text: string)` — validates required columns (`loan_id`, `full_name`, `outstanding_balance`), parses all fields from the spec table, returns `{ rows: CsvRow[], errors: string[] }`
- [x] 5.2 Add i18n keys for all portfolio and CSV-import UI strings (labels, errors, mode descriptions, result messages) to `mods/webapp/src/lib/i18n.tsx`

## 6. Webapp — Portfolios UI

- [x] 6.1 Add Portfolios route to the app router and a nav entry in the sidebar
- [x] 6.2 Create `mods/webapp/src/pages/Portfolios.tsx` with a `DataTable` listing portfolios (name, clientId, accounts, totalOutstandingBalance, recoveredAmount, status, createdAt), status filter, and a "New Portfolio" button
- [x] 6.3 Create `CreatePortfolioModal` (inside `Portfolios.tsx`): fields for name, clientId, totalAmount; calls `portfolios.create`
- [x] 6.4 Create `EditPortfolioModal` (inside `Portfolios.tsx`): name and status fields; delete button that triggers `ConfirmDeleteDialog`; calls `portfolios.update` / `portfolios.delete`
- [x] 6.5 Create `CsvSyncModal` (inside `Portfolios.tsx`): file picker → client-side parse → error display → mode selector (APPEND_ONLY / UPDATE_EXISTING / REPLACE with descriptions) → import button → result summary (created / updated / deleted / total); calls `portfolios.syncAccounts`
- [x] 6.6 Create `mods/webapp/src/pages/PortfolioDetail.tsx`: paginated `DataTable` of portfolio accounts using `portfolios.listAccounts`; link to it from the portfolio list row
