## Context

The `api-keys` capability (shipped 2026-06-23) originally attempted both an expiry input at creation
and a "Creada" column in the list. Both were live-tested against the real Identity backend and pulled
after a smoke test found timestamps came back wrong: Identity's `ApiKey.expires_at` / `created_at` /
`updated_at` proto fields are `int32`, but `createCreateApiKey` did `new Date(expiresAt)` (treating the
wire value as epoch **ms**) and `createListApiKeys` serialized Prisma's `Date` objects straight through
(also epoch ms) into that `int32` field. Either direction silently produces a wrong value — an
already-expired key on create, garbage/negative numbers on list — with no error. The workaround at the
time: drop the expiry input, drop the column, keep `createApiKeySchema.expiresAt` as an unused optional
field for forward compatibility.

That bug is now fixed in a local `fonoster/fonoster` worktree
(`/Users/psanders/Projects/fonoster-worktrees/fix-apikey-timestamp-units`, branch
`fix/apikey-timestamp-units`, committed, not yet pushed/published): both the create and list handlers,
and the shared `ApiKey` TS type, now consistently use epoch **seconds** — the only unit that actually
fits in `int32` (valid until 2038).

## Goals / Non-Goals

**Goals:**

- Show `createdAt` in the API Keys list.
- Let an operator set an optional expiry when creating a key.
- Do both without qcobro holding any local timestamp-conversion knowledge beyond one boundary: the
  create call to Identity.

**Non-Goals:**

- Fixing the `int32` ceiling itself (2038) — out of scope; that would mean widening Identity's proto,
  a larger cross-repo change with its own migration story.
- Publishing the fonoster fix or opening its upstream PR — tracked separately; this change only
  depends on consuming a local build of it for verification.
- Touching the Members/owner-name issue — separate change, separate PR.

## Decisions

- **Unit boundary lives in apiserver, not webapp or common.** `createApiKeySchema.expiresAt` stays in
  epoch **ms** — that's the JS-idiomatic unit already used elsewhere in the app (e.g. `Date.now()`),
  and it's what the schema's `refine((ms) => ms > Date.now())` check assumes. The apiserver `create`
  procedure converts ms → seconds in the one call to `ctx.identity.createApiKey`, mirroring the
  existing read-side conversion the webapp's `fmtDate` already does (seconds → ms) for `list`.
  Alternative considered: convert at the webapp form boundary instead — rejected, since the webapp
  already treats `expiresAt` as ms end-to-end (list) and apiserver is the only layer that talks to
  Identity's actual wire format.
- **No change to `@qcobro/common`'s `createApiKeySchema`.** It already validates an optional,
  positive, future `expiresAt` in ms; that contract doesn't change, only what apiserver does with the
  validated value.
- **Local verification via a built copy of the fonoster fix**, not `npm link`, to avoid mutating
  qcobro's `package.json`/lockfile for an unpublished dependency version. The fix's package is copied
  into `node_modules/@fonoster/identity` (and `identity-client` if needed) after building, purely for
  running the local dev stack during this change's Test stage. `package.json` continues to declare the
  real published semver range; this change does not bump it. Once fonoster publishes a release
  containing the fix, a trivial follow-up bumps the version — no code changes anticipated.

## Risks / Trade-offs

- [Upstream fix isn't published yet] → qcobro's own CI/other environments can't exercise this feature
  until fonoster publishes a release with the fix. Mitigation: this change proceeds and is verified
  locally; merging is fine since the code path is inert (times out gracefully, per existing
  `fmtDate` implausible-date guard) until the dependency catches up — but flag this as a known gap
  when opening the PR.
- [int32 ceiling is 2038] → an expiry set far enough in the future (or a key that simply lives past 2038) can't be represented. Not addressed here; same ceiling the upstream fix already accepted as
  the pragmatic near-term fix.
- [Local `node_modules` copy could look like a working published version but isn't] → be explicit in
  the PR description that this is blocked on an upstream release, so nobody assumes it's live in
  other environments.

## Migration Plan

No data migration. This is a pure UI/procedure change reading/writing fields Identity already stores.
Deploy order: upstream fonoster release must land (or be otherwise made available) before this change
is meaningful in any environment beyond local dev. No rollback concerns beyond a normal revert.

## Open Questions

- When will the fonoster fix be published? (Tracked outside this change — see proposal Impact.)
