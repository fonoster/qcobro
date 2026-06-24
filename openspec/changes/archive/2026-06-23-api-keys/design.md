## Context

The SDK ship landed `auth.exchangeApiKey` (apiserver) + `loginWithApiKey` (SDK), proving the
end-to-end path: an `accessKeyId` + `accessKeySecret` exchanged at Fonoster Identity yields tokens.
But nothing can **mint** a key. The Identity service already implements the full CRUD
(`createApiKey`, `listApiKeys`, `regenerateApiKey`, `deleteApiKey` under
`mods/identity/src/apikeys/`), and the gRPC contract is fixed:

- `ApiKey = { ref, accessKeyId, role, expiresAt, createdAt, updatedAt }` — **no name, no status**.
- `createApiKey({ role, expiresAt? }) → { ref, accessKeyId, accessKeySecret }`.
- `regenerateApiKey(ref) → { ref, accessKeyId, accessKeySecret }`.
- `deleteApiKey(ref)` — hard `prisma.apiKey.delete`.
- `Role = USER | WORKSPACE_OWNER | WORKSPACE_ADMIN | WORKSPACE_MEMBER`; keys default to
  `WORKSPACE_MEMBER`.

The gap is purely the wrapper + apiserver + UI. The webapp already has the admin-cluster pattern:
`UserMenu` links to `/profile`, `/settings` (`WorkspaceSettings`), `/members` (`Members`), and
`WorkspaceSettings` reads the caller's workspace role from the access-token claims via `activeRole`.

## Goals / Non-Goals

**Goals:**

- A dedicated, owner/admin-gated `/api-keys` page to list, create, regenerate, and delete keys.
- Show the `accessKeySecret` exactly once on create/regenerate, with copy-to-clipboard.
- A thin `apiKeys` tRPC router proxying Identity through the context; shared Zod contract in
  `@qcobro/common`.
- Reuse existing UI primitives and the type-to-confirm modal idiom from `WorkspaceSettings`.

**Non-Goals:**

- No friendly key name/label (Identity has no field for it).
- No soft-disable/revoke distinct from delete (no such endpoint) — delete _is_ revocation.
- No per-key usage analytics, no granular scopes beyond the workspace `Role`.
- No DB changes in this repo (keys live in Identity's datastore).

## Decisions

**D1 — Placement: dedicated `/api-keys` page in the user-menu admin cluster.** Keys are
workspace-scoped credentials carrying a role — the same scope as Members — so they belong beside
_Miembros_ and _Configuración del espacio_, not in _Mi perfil_ (personal scope) and not in the
left sidebar (operational features). Chosen over a card/tab inside `WorkspaceSettings`: a keys
table + create/regenerate/delete modals would overload a page that is today a single name form,
and a dedicated page leaves room to grow. _(User-confirmed.)_

**D2 — Role-gated like `WorkspaceSettings`.** Reuse the `activeRole(accessToken, accessKeyId)`
claim-reading helper to require owner/admin. The apiserver router stays on `protectedProcedure`;
Identity remains the ultimate authority, but the UI hides management from non-admins and the
router can reject early. The menu item is only rendered for owner/admin.

**D3 — No role choice; keys are admin-scoped.** Fonoster Identity's `createApiKeyRequestSchema`
is `z.enum([WORKSPACE_ADMIN])` — it rejects any other role for an API key (verified live: a
`WORKSPACE_MEMBER` create returns a validation error from the Identity gRPC). So unlike member
invites there is no role selector: every key is granted the workspace admin role. `apiKeyRoleEnum`
is `z.enum(["WORKSPACE_ADMIN"])` and the create form shows only a note that keys are admin-scoped.
_(Corrected during build — the original ADMIN+MEMBER assumption was wrong; caught by testing create
against the live backend.)_

**D4 — Secret-shown-once via a result dialog.** `create` and `regenerate` return the secret; the
page captures it into a one-time modal with copy-to-clipboard and a "store it now" warning, then
discards it from memory on dismiss. `list` and the table never hold a secret. This is a behavioral
guarantee in the spec, enforced by the router never echoing secrets on `list`.

**D5 — No expiry input (blocked upstream).** Identity's proto types `expires_at`, `created_at`,
`updated_at` on the `ApiKey`/`CreateApiKeyRequest` messages as **`int32`**, yet the service stores
them via `new Date(value)` (epoch ms). No value both fits `int32` (max ~2.1e9) and yields a correct
future `Date`: epoch ms (~1.78e12) overflows `int32` (Identity then rejects it as "not positive"),
while epoch seconds fit but resolve to ~1970. The same overflow garbles the `createdAt` returned by
`list` (e.g. `-155482674`). So timestamps can't round-trip until Identity widens these to `int64`
(and/or multiplies). Decision: the create UI omits expiry entirely (keys are non-expiring), the
table shows "Sin vencimiento", and `fmtDate` degrades implausible timestamps to "—". The shared
`createApiKeySchema` keeps an optional `expiresAt` for forward compatibility. _(Found via smoke test
during fix-up; was originally specced as an epoch-ms input.)_

**D6 — Upstream wrapper methods.** Add `createApiKey`, `listApiKeys`, `regenerateApiKey`,
`deleteApiKey` to `@fonoster/identity-client` (sibling `../fonoster`), mirroring the existing
`exchangeApiKey`/`listWorkspaceMembers` unary wrappers, then rebuild so the apiserver typechecks.
Same upstream-edit pattern as the SDK ship's `exchangeApiKey` addition.

**D7 — Shared contract in `@qcobro/common`.** New `src/schemas/apiKeys.ts`: `apiKeyRoleEnum`,
`createApiKeySchema` (`{ role, expiresAt? }`), `apiKeyRefSchema` (`{ ref }`), plus the result
shapes (`apiKeySchema` without secret for list, and the secret-bearing create/regenerate result).
Both apiserver and webapp consume these — no duplicated types.

## Risks / Trade-offs

- **Upstream wrapper edit may be blocked by the harness** (as it was for `exchangeApiKey` in the
  SDK ship) → surface the exact diff at build stage and get explicit user approval; the apiserver
  won't typecheck until the wrapper rebuilds.
- **Token claims can go stale** — a role change isn't reflected until token refresh, so the UI gate
  may briefly mismatch Identity's authority → acceptable; Identity is the final enforcer and the
  router errors are surfaced. Same trade-off `WorkspaceSettings` already accepts.
- **Secret only shown once** — if the operator misses the copy step they must regenerate → mitigated
  by an explicit warning and copy-to-clipboard; regenerate is cheap and non-destructive to the key's
  identity.

## Migration Plan

1. Land the four wrapper methods in `../fonoster` `@fonoster/identity-client`; rebuild it.
2. Add the shared schemas to `@qcobro/common`; build.
3. Add the apiserver `apiKeys` router; typecheck against the rebuilt wrapper.
4. Ship the webapp page, route, and menu item.

No data migration — keys are created on demand against the existing Identity datastore. Rollback is
removing the route/menu item and router; existing keys remain valid and usable by the SDK.

## Open Questions

- None blocking. Assignable-role set (D3) and expiry handling (D5) are decided defaults and easily
  revisited if product wants owner-role keys or no-expiry-only.
