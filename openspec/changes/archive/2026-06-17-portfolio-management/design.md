## Context

The main branch has a workspace-scoped, Postgres-backed API server with an Identity gRPC bridge for auth/tenancy, but no domain models beyond a `HealthCheck` stub. The `demo` branch has a fully working portfolio/account implementation (SQLite, no workspace scoping) that proves the data model and three-mode sync algorithm. This design adapts that precedent to the multi-tenant Postgres architecture.

Portfolios are the foundational data entity: campaigns cannot exist without a portfolio to draw customer accounts from.

## Goals / Non-Goals

**Goals:**

- Workspace-scoped Portfolio CRUD with status lifecycle (ACTIVE / CLOSED)
- PortfolioAccount records carrying full loan, contact, and delinquency fields keyed by `loan_id`
- CSV import flow with three sync modes — append-only, merge, replace
- Paginated account listing per portfolio
- Aggregate stats (account count, total outstanding balance) kept in sync atomically on each import

**Non-Goals:**

- External REST/webhook API for automated customer sync — deferred; the CSV import covers MVP needs
- Server-side CSV upload (multipart) — for MVP, CSV is parsed client-side in the webapp and rows are forwarded via tRPC; payload limits are acceptable for expected list sizes
- Campaign linkage — portfolios will be referenced by campaigns in a future change; no campaign logic here
- Per-account activity history — belongs to the campaigns capability

## Decisions

### 1. Workspace scoping via `workspaceRef`

**Decision**: `Portfolio` carries a `workspaceRef` string (the Identity workspace ref), not a foreign key to a local `Workspace` table. All list/get/mutate procedures filter by the `workspaceRef` extracted from the caller's token via tRPC context.

**Rationale**: Workspace entities live in Fonoster Identity, not locally — consistent with how workspaces and memberships are already handled. A local FK would create a shadow table that diverges from Identity as the source of truth.

**Alternative considered**: Local `Workspace` table with FK. Rejected because it duplicates Identity state and requires synchronization logic.

### 2. Retain `clientId` as an external client identifier

**Decision**: Portfolio keeps a `clientId` free-text field representing the institution whose debt is being collected (e.g., `bancolombia-q2-2025`). This is distinct from `workspaceRef` (tenancy).

**Rationale**: In a debt-collections context the workspace operator is the collections agency; the `clientId` identifies the creditor client whose portfolio they are managing. These are often different organizations.

### 3. Client-side CSV parsing, rows sent over tRPC

**Decision**: The webapp parses the CSV to a typed row array and sends it in the `syncAccounts` mutation payload. No multipart upload endpoint.

**Rationale**: Eliminates an S3/storage dependency for MVP. CSV files for typical debt portfolios (hundreds to low thousands of accounts) are well within tRPC's payload limits.

**Alternative considered**: Server-side multipart upload. Deferred — add when file size becomes a real constraint.

### 4. Three sync modes — REPLACE uses soft-delete

**Decision**: `APPEND_ONLY` (add new, skip existing) | `UPDATE_EXISTING` (add new + update existing) | `REPLACE` (add new + update existing + **soft-archive** records absent from CSV). All three run inside a single Prisma transaction.

`PortfolioAccount` carries an `archivedAt DateTime?` field. In REPLACE mode, accounts absent from the incoming batch are marked `archivedAt = now()` rather than hard-deleted. If a previously-archived loan_id reappears in a future sync it is un-archived (`archivedAt = null`) and its fields updated — history is preserved.

Active queries (listing, stats) always filter `WHERE archivedAt IS NULL`. Archived accounts remain in the database and can reference campaign activity, commitment records, and call history without broken FKs.

**Rationale**: Hard-deleting accounts breaks referential integrity the moment campaigns and activity records are introduced. Soft-delete costs one nullable column and one filter clause in exchange for safe re-sync semantics and a complete audit trail.

**Alternative considered**: Hard-delete with a cascade rule. Rejected — silently destroys historical data when operators refresh their master list.

### 5. Aggregate stats computed over active accounts only

**Decision**: After mutating account rows, the transaction re-computes `accountCount` and `totalOutstandingBalance` via `COUNT` and `SUM` aggregates filtered to `archivedAt IS NULL` and writes them back to `Portfolio`. Stats are never maintained incrementally.

**Rationale**: Incremental bookkeeping (±delta) drifts on partial failures. A full re-aggregate inside the same transaction is always consistent at the cost of one extra query per sync — acceptable for MVP volumes. Filtering archived accounts ensures stats reflect the current active portfolio, not the full history.

### 6. Validated-function pattern for service logic

**Decision**: `syncAccounts`, `createPortfolio`, `updatePortfolio`, and `deletePortfolio` are implemented as validated functions (DI + Zod) in `mods/apiserver/src/functions/`. tRPC procedures are thin callers that pass `ctx.prisma` as the client.

**Rationale**: Required by CLAUDE.md for any function that takes external input and performs DB writes. Keeps procedures testable without a live database.

### 7. tRPC is one transport; REST is the planned extension for external sync

**Decision**: All sync business logic lives in the validated functions, not in the tRPC layer. tRPC procedures are pure transport adapters. A future `portfolio-sync-api` change will add a REST endpoint (`POST /api/v1/portfolios/{id}/accounts/sync`) that calls `createSyncAccounts` directly — no logic duplication.

**Rationale**: External integrators (Python, Java, ETL pipelines) cannot consume tRPC. Keeping the function layer transport-agnostic means adding REST is a thin HTTP handler, not a rewrite. No REST endpoint is built here because no external integrator exists yet; building it speculatively adds auth complexity (API keys vs. session tokens) that isn't justified for MVP.

**Extension path**: When external sync is needed, add API-key authentication and a multipart-capable REST handler over the same `createSyncAccounts` function.

## Risks / Trade-offs

- **Large CSV payloads** → tRPC body size limit hit for very large portfolios (10k+ accounts). Mitigation: document the practical limit (~2 000 rows recommended); defer multipart upload to the REST transport change.
- **Sync transaction duration** → REPLACE mode on a large existing portfolio locks the accounts table for the duration. Mitigation: acceptable for MVP volumes; batch-archiving optimization deferred.
- **Archived account accumulation** → repeated REPLACE syncs grow the `portfolio_accounts` table with archived rows. Mitigation: acceptable at MVP scale; a future maintenance job can purge accounts archived beyond a retention window (e.g., 90 days with no campaign activity).

## Open Questions

- Should `clientId` be validated against a future `Clients` entity, or stay free-text forever? (Defer — free-text for now.)
- Should `recoveredAmount` be manually editable, or computed from future Commitment records? (For MVP, manually editable; campaigns/commitments will own this later.)
