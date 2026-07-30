## Why

PR #62 shipped a contained stopgap for an upcoming demo: inbound WhatsApp reply matching
(`loadByPhoneAndSender`) normalizes both sides to E.164 at match time and scans the workspace's 50
most recent WHATSAPP contact logs in JS, because `portfolioAccount.phone` is stored verbatim from
CSV import (no format validation) and Prisma's JSON-path `equals` on `channelData.to` can't
normalize server-side. That match-time workaround silently drops inbound replies whenever the
customer's canonical number doesn't happen to be one of the 50 most recent WHATSAPP dispatches in
the workspace, and it does real work (candidate scan) on every inbound webhook call instead of a
direct lookup. The proper fix is upstream: make phone canonical E.164 wherever it's written, then
inbound correlation can go back to a direct, indexed/exact query.

## What Changes

- Add a strict, throwing E.164 phone validator in `mods/common` (fresh implementation, layered on
  top of the existing lenient `normalizePhoneE164` from PR #62), built as a validated function
  (factory + Zod schema + `withErrorHandlingAndValidation`) per this repo's convention.
- Wire that validator into portfolio account CSV/API import (`createSyncAccounts`) so
  `portfolioAccount.phone` is canonical E.164 at write time; a row with an unparseable phone fails
  the whole import (validate-before-write, same atomicity the rest of the row schema already has).
  Pre-existing rows with non-canonical phone already in the database are **not** backfilled by this
  change (called out explicitly as deferred, not silently dropped).
- No change needed in `dispatchOutreach` itself — it relays `to` verbatim, and `to` always
  originates from `portfolioAccount.phone` (campaign engine and manual outreach both read it), so
  once phone is canonical at rest, `channelData.to` is canonical at dispatch time for free.
- Audit SMS and voice dispatch paths for the same latent exact-match-on-phone assumption on inbound
  correlation. Finding: voice inbound correlates by `callRef` (a providerRef), email inbound
  correlates by a reply-to token embedded in the address — neither matches on phone. SMS has no
  inbound webhook in this codebase at all. This item concludes as an audit with no code change.
- Revert `loadByPhoneAndSender` in `whatsAppWebhook.ts` from the bounded 50-row scan back to a
  direct, indexed/exact Prisma query (`channelData` JSON-path `equals` filter,
  `portfolioAccount.portfolio.workspaceRef` scoping preserved from PR #64), short-circuiting to
  `null` immediately when the inbound number doesn't normalize instead of always running the query.

## Capabilities

### New Capabilities

(none — this change tightens existing capabilities, it doesn't introduce a new one)

### Modified Capabilities

- `portfolio-accounts`: account phone import now validates and normalizes to E.164 at write time;
  an unparseable phone number fails the CSV/API import for the whole batch instead of being stored
  verbatim.
- `whatsapp-channel`: inbound webhook message-to-gestión correlation now matches on canonical E.164
  via a direct/exact query instead of a bounded recent-log scan with runtime normalization.

## Impact

- `mods/common/src/utils/` — new strict/throwing E.164 validator + schema.
- `mods/apiserver/src/functions/portfolios/syncAccounts.ts` — validates/normalizes `phone` before
  writing each row; whole import fails atomically on the first invalid phone.
- `mods/apiserver/src/rest/whatsAppWebhook.ts` — `loadByPhoneAndSender`'s Prisma query shape
  reverts to a direct filter, dropping the 50-row scan and in-process candidate matching.
- No schema/migration changes (no new columns or indexes required — `channelData` JSON-path
  filtering and existing relations are sufficient).
- No changes to `dispatchOutreach.ts`, voice inbound, email inbound, or SMS (audit-only, no fix
  needed there).
