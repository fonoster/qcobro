## Context

Portfolios are refreshed via CSV sync (`portfolio-accounts` capability, `SyncMode` of APPEND_ONLY / UPDATE_EXISTING / REPLACE). Today the `Portfolio` record tracks `accountCount`, `totalOutstandingBalance`, and `recoveredAmount`, all of which are recomputed atomically when a sync completes — but there is no record of _when_ the last sync happened. Operators managing dozens of portfolios currently have to open each one to guess staleness.

## Goals / Non-Goals

**Goals:**

- Record the timestamp of the most recently completed CSV sync per portfolio.
- Surface it in the portfolio list so operators can scan for stale portfolios.

**Non-Goals:**

- No sync history/audit log (only the latest timestamp is kept).
- No automated staleness alerts or sorting/filtering by staleness in this change.
- No change to sync mechanics, aggregate-stat computation, or concurrency handling — this only adds one more field written in the same transaction.

## Decisions

- **Field placement**: add `lastSyncedAt DateTime?` directly on the `Portfolio` model, alongside `accountCount`/`totalOutstandingBalance`, rather than a separate sync-log table. Rationale: matches the existing pattern for other sync-derived aggregates, and a history table is unneeded for a "last synced" display (Non-Goal above).
- **Write path**: set `lastSyncedAt` to the current server time in the same transaction that updates `accountCount`/`totalOutstandingBalance` during CSV sync, so it stays consistent with the "Stats are read-consistent" scenario already required by `portfolios` spec (concurrent syncs: last-completed sync wins).
- **Never-synced state**: leave `lastSyncedAt` `null` until the first successful sync; the webapp renders a localized "Never" placeholder rather than a fabricated date.
- **Transport**: extend the existing `Portfolio` Zod schema in `@qcobro/common` with `lastSyncedAt: z.date().nullable()` rather than adding a separate procedure — `portfolios.list`/`portfolios.read` already return the full portfolio record.

## Risks / Trade-offs

- [Existing rows have no historical sync time] → `lastSyncedAt` defaults to `null`/unmigrated; the UI's "Never" placeholder covers this correctly even for portfolios that were, in fact, synced before this change shipped (acceptable: no historical data exists to backfill).
- [Column adds width to an already dense table] → follow the same compact date formatting used elsewhere in the console (e.g. relative or short date), no new UI pattern introduced.
