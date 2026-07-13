## Why

Operators managing many portfolios have no way to tell how stale a portfolio's account data is without opening it and checking gestión history. A "last synced" timestamp on the portfolio list lets them spot portfolios that haven't been refreshed recently at a glance.

## What Changes

- Add a `lastSyncedAt` timestamp to the `Portfolio` record, set whenever a CSV sync completes for that portfolio.
- Expose `lastSyncedAt` on the `portfolios.list` and `portfolios.read` tRPC procedures.
- Add a "Last synced" column to the portfolio list table in the webapp, showing a relative/localized timestamp, or a placeholder (e.g. "Never") when the portfolio has not yet been synced.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `portfolios`: portfolio records gain a `lastSyncedAt` field that is set on CSV sync completion and returned by list/read.
- `portfolio-accounts`: CSV sync completion SHALL also stamp the parent portfolio's `lastSyncedAt`.
- `web-console`: the portfolio list table gains a "last synced" column.

## Impact

- `mods/apiserver/prisma/schema.prisma` — new `lastSyncedAt` field on `Portfolio`.
- `mods/apiserver` — CSV sync procedure/service sets `lastSyncedAt`; `portfolios.list`/`portfolios.read` return it.
- `@qcobro/common` — shared `Portfolio` type/schema gains `lastSyncedAt`.
- `mods/webapp/src/pages/Portfolios.tsx` — new table column.
