## Context

`portfolioAccount.phone` is written verbatim from CSV import
(`mods/apiserver/src/functions/portfolios/syncAccounts.ts`) with no format validation
(`accountRowSchema.phone` in `mods/common/src/schemas/portfolios.ts` is a bare
`z.string().optional()`). Both the campaign engine (`engine.ts`, `to: acc.phone!`) and manual
outreach (`trpc/routers/outreach.ts`, `to = account.phone!`) relay this value verbatim into
`dispatchOutreach`, which writes it into `channelData.to` on the `AccountContactLog` row created at
dispatch time. Meta's webhook `from` field arrives digits-only, no `+`.

PR #62 fixed this at the read side only: `loadByPhoneAndSender` in
`mods/apiserver/src/rest/whatsAppWebhook.ts` normalizes both the stored `channelData.to` and the
inbound `from` to E.164 with the new lenient `normalizePhoneE164` (`mods/common/src/utils/
normalizePhone.ts`, using the `phone` npm package, returns `null` instead of throwing), then scans
the workspace's 50 most recent WHATSAPP contact logs in JS because Prisma's JSON-path `equals`
can't normalize server-side. That is a bounded, correct-enough stopgap for a demo, not a permanent
fix — it silently misses matches older than the 50-row window and does unnecessary work (fetch +
scan) on every inbound webhook call even when a direct query would do.

## Goals / Non-Goals

**Goals:**

- Make `portfolioAccount.phone` canonical E.164 at write time, so everything downstream
  (`channelData.to` at dispatch) is canonical for free.
- Add a strict, throwing E.164 validator for input boundaries — this repo's own implementation,
  not ported from mikro (a separate repo we don't have access to), following the validated-function
  convention (factory + Zod schema + `withErrorHandlingAndValidation`).
- Audit SMS and voice inbound-correlation paths for the same latent phone-exact-match assumption.
- Revert `loadByPhoneAndSender` to a direct, indexed/exact Prisma query once phone is canonical.

**Non-Goals:**

- Backfilling `phone` on portfolio accounts already in the database. Existing rows keep whatever
  format they were imported with; only new imports (and updates via `UPDATE_EXISTING`/`REPLACE`
  sync modes, which rewrite every field including `phone`) get canonical E.164. This is an explicit
  scope cut — see Risks below.
- Adding an inbound SMS webhook. None exists in this codebase today; the audit in this change
  covers only "does an existing inbound path share this bug," and concludes SMS has no inbound path
  to share it with.
- Enforcing E.164 at the `dispatchOutreachSchema.to` boundary itself (defense-in-depth). Deferred:
  doing so today would hard-fail dispatch to any account imported before this change with a
  non-canonical phone, which is a bigger behavior change than this bug-fix scope should make
  unilaterally.

## Decisions

### 1. Strict validator lives in `mods/common`, as a validated function

`normalizePhoneE164` (lenient, PR #62) stays as-is — it's correct for its one caller
(`loadByPhoneAndSender`), where "doesn't parse" must mean "no match," not a crash mid-webhook.

The new strict variant is a separate function, `createValidatePhoneE164`, built with this repo's
validated-function pattern: a Zod schema (`{ phone: string }`) wraps `withErrorHandlingAndValidation`
around a `fn` that calls `normalizePhoneE164` and throws a `ValidationError` (the same structured
error every other write-boundary in this codebase throws) when it returns `null`. It has no injected
dependencies — still built as a factory for consistency, so every caller gets the same
`ValidationError`/`fieldErrors` shape the tRPC error formatter already knows how to surface, instead
of a one-off `Error` type specific to phone numbers.

Alternative considered: a plain throwing function (`validatePhoneE164(input): string`, no factory,
no Zod schema). Simpler, but produces a bespoke `Error` that callers/formatters would need a special
case for. Rejected in favor of consistency with every other input-validating function in this repo.

### 2. Validate-before-write in `syncAccounts`, not inside `accountRowSchema`

`accountRowSchema.phone` stays a bare optional string — it's the CSV-row _parsing_ schema, and
loosening/tightening it has wider blast radius (webapp CSV preview, other future readers of this
schema). Normalization is enforced in `createSyncAccounts` instead: before opening the `$transaction`,
every row's `phone` (when present) is run through `createValidatePhoneE164()`. If any row fails, the
whole call throws before any DB write happens — consistent with the existing behavior where the
outer `syncAccountsInputSchema` already validates the whole batch before `createSyncAccounts` runs
at all. An import is all rows canonical or no rows written; there is no partial-import/per-row-skip
mode for phone specifically (other fields already work this way too — e.g., `outstandingBalance <
0` fails the whole batch via the existing schema).

Alternative considered: transform `accountRowSchema.phone` itself (Zod `.transform` +
`ctx.addIssue`) so invalid phones fail at the outer schema-parse stage, before `createSyncAccounts`
is even invoked. Rejected for now because the throwing validator is async-shaped (`Promise<string>`)
to match this repo's validated-function convention, and the outer schema is parsed synchronously
(`schema.safeParse`) by `withErrorHandlingAndValidation` — making the transform async would require
switching every consumer of `syncAccountsInputSchema` to `safeParseAsync`, a bigger and unrelated
change. Validating inside the function body achieves the same fail-before-write guarantee without
touching the schema layer.

### 3. `loadByPhoneAndSender` reverts to the pre-PR-#62 query shape, keeping the PR #64 fix

Restored query: `accountContactLog.findFirst` filtered by `agentType: "WHATSAPP"`,
`channelData: { path: ["to"], equals: normalizedCustomer }`, and
`portfolioAccount: { portfolio: { workspaceRef: sender.workspaceRef } }` — the last clause is PR
#64's fix (scoping by portfolio, not `campaign.workspaceRef`, which drops campaign-less
manual-outreach gestiones because Prisma's nested filter excludes rows where an optional relation
is null). `orderBy: contactedAt desc`, no `take` — `findFirst` already returns at most one row.
Additionally short-circuits to `null` before querying at all when
`normalizePhoneE164(customerPhone)` returns `null` (today's code runs the query unconditionally
even when the inbound number can't normalize).

### 4. No schema/migration changes

`channelData` JSON-path filtering doesn't require a new column or index to function correctly —
it worked pre-PR-#62 at whatever the workspace's WHATSAPP-log volume was then, and normalized data
makes it correct again. No `@@index` addition is in scope for this change; if lookup latency proves
to be a problem at production data volumes, that's a separate, measured follow-up.

## Risks / Trade-offs

- **[Risk]** Existing rows imported before this change (or before a `REPLACE`/`UPDATE_EXISTING`
  re-sync) keep non-canonical phone, so `loadByPhoneAndSender`'s exact query still won't match
  their `channelData.to` values. → **Mitigation**: none in this change (explicit non-goal); flagged
  here so a future backfill change has this design doc as context. Operationally, workspaces can
  force canonicalization by re-syncing with `mode: "REPLACE"` or `"UPDATE_EXISTING"`.
- **[Risk]** Rejecting an entire CSV batch on one bad phone number is stricter than before (today
  bad data silently lands in the DB; after this change, the whole import fails). → **Mitigation**:
  this matches the existing atomicity of every other validated field on the row (e.g. a negative
  balance already fails the whole batch); operators get a `ValidationError` with the offending
  row's field path, same UX shape as any other row-validation failure today.
- **[Trade-off]** SMS/voice audit (item 2) produces no code change. → Documented here and in tasks
  so the audit itself is a visible, checkable deliverable, not silently skipped.

## Migration Plan

No data migration. Ships as a normal code deploy:

1. Merge the strict validator + `syncAccounts` wiring — new/re-synced imports start writing
   canonical E.164.
2. Merge the `loadByPhoneAndSender` query revert — inbound matching for any gestión whose
   `channelData.to` is canonical (all new dispatches, plus any account re-synced after step 1)
   starts using the exact/indexed path immediately.
   No rollback complexity: both changes are stateless code changes; reverting either commit restores
   prior behavior with no data cleanup required.

## Open Questions

- None blocking. Backfilling legacy `phone` values is explicitly deferred (see Non-Goals) and would
  need its own proposal if prioritized.
