## Why

The `api-keys` capability spec currently documents two deliberate omissions — no creation date shown
in the list, and no expiry offered at creation — both traced to a real upstream bug: Fonoster
Identity's `ApiKey.expires_at`/`created_at`/`updated_at` wire fields are `int32`, but the service read
and wrote them as epoch milliseconds, so any real timestamp either overflowed to garbage (list) or
landed near the Unix epoch (create). That bug is now fixed upstream (Identity's apikeys handlers and
shared `ApiKey` type consistently use epoch seconds, matching the `int32` wire width) in a local
`fonoster/fonoster` worktree, committed but not yet published. With the underlying contract sound, both
workarounds can be reversed.

## What Changes

- Restore the "Creada" (created) column to the API Keys list, reusing the existing `fmtDate` helper the
  same way the `expiresAt` column already renders it.
- Restore the expiry input to the create-key dialog, wired to `createApiKeySchema`'s existing
  `expiresAt` field (epoch ms).
- Convert `expiresAt` from epoch ms to epoch seconds at the one apiserver boundary that calls Identity's
  `createApiKey` (`mods/apiserver/src/trpc/routers/apiKeys.ts`), mirroring the existing ms-widening
  already done for `list` results on the read side.
- No change to `createApiKeySchema` itself (already accepts optional `expiresAt` in ms) and no local
  DB/Prisma changes — qcobro holds no local `ApiKey` table; this is pass-through to Fonoster Identity.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `api-keys`: "List workspace API keys" requirement changes from "creation date is not shown" to
  showing `createdAt`. "Create an API key" requirement changes from "keys are created without an
  expiration, not offered" to allowing an optional expiry to be set at creation.

## Impact

- `mods/webapp/src/pages/ApiKeys.tsx` — add `createdAt` to `Row` + a table column.
- `mods/webapp/src/components/CreateApiKeyDialog.tsx` — add an expiry input, remove the
  now-outdated comment explaining why it was omitted.
- `mods/apiserver/src/trpc/routers/apiKeys.ts` — convert `expiresAt` ms → seconds before calling
  `ctx.identity.createApiKey`.
- Upstream dependency: `@fonoster/identity` / `@fonoster/identity-client` must be built from the fixed
  local worktree (`fonoster/fonoster`, branch `fix/apikey-timestamp-units`) for local verification, and
  eventually published for this change to work in any non-local environment.
