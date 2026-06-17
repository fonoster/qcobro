## Why

Campaigns — the mechanism that drives AI voice outreach — need a customer list to call. Portfolios are that list: a workspace-scoped grouping of debtor accounts that defines _who_ gets contacted and _what_ their debt situation is. Without portfolios, campaigns have no data to act on.

## What Changes

- Introduce a `Portfolio` entity scoped to a workspace — operators can create, read, update, and delete portfolios within their workspace.
- Introduce a `PortfolioAccount` entity — the individual debtor record carrying all loan, contact, and delinquency fields needed by the AI agent during a call.
- Add a CSV import flow with three sync modes: append-only (add new records only), merge (add new + update existing), and replace (full overwrite: add, update, and delete stale records).
- Expose a paginated account listing per portfolio so operators can inspect and verify imported records.
- Portfolios track aggregate stats (account count, total outstanding balance) that update atomically on each sync.

## Capabilities

### New Capabilities

- `portfolios`: CRUD for portfolio entities, scoped to the active workspace. Includes status lifecycle (ACTIVE → CLOSED) and aggregate stats (account count, total balance, recovered amount).
- `portfolio-accounts`: Debtor account records within a portfolio. Covers CSV parsing rules, the three sync modes, paginated listing, and the `loan_id`-keyed uniqueness constraint.

### Modified Capabilities

_None — no existing requirement specs change._

## Impact

- **apiserver**: New tRPC router (`portfolios`) with procedures `list`, `get`, `create`, `update`, `delete`, `listAccounts`, `syncAccounts`. New Prisma models `Portfolio` and `PortfolioAccount` with a migration.
- **webapp**: New Portfolios page (list + detail), Create/Edit portfolio modals, CSV import modal with mode selection, account data table.
- **common**: New Zod schemas for portfolio and portfolio-account input/output; new `PortfolioClient` interface for DI.
- **No breaking changes** to existing procedures or data models.
