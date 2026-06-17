## Context

QCobro needs authentication, authorization, and multi-tenancy. We reuse Fonoster Identity
(`@fonoster/identity`, MIT) — a gRPC service over Postgres with users, workspaces, members,
roles, RS256 JWTs, and RBAC — rather than building our own. Identity ships as a service binary
with no client SDK, and Fonoster only publishes it bundled inside the monolithic
`fonoster/apiserver` image. The proto lives upstream at `mods/common/src/protos/identity.proto`
(package `fonoster.identity.v1beta2`).

The foundation already left the seam for this: the tRPC context reserves a nullable `user` and a
bearer-token field, and services are reached through the context.

## Goals / Non-Goals

**Goals:**

- Run Identity as its own gRPC service with its own database, in Docker Compose.
- Generate the missing TypeScript gRPC client and reach Identity through the tRPC context.
- Sign-up, login, token refresh/revoke; verified context (user + active workspace + role).
- Workspace lifecycle and membership (invite-with-role, accept/resend, list, remove).
- Workspace-scoped authorization; minimal console auth UI; dev email via Mailpit.

**Non-Goals:**

- OAuth2 / social login, API-key management UI, MFA enforcement, custom roles.
- Modifying Identity's internals (we consume it as-is, including its password storage).
- Domain resource tenant-scoping beyond establishing the workspace key in context.

## Decisions

**Reuse Identity as a service; do not fork it.** We consume the upstream service unchanged, so
its design choices (including reversible password encryption rather than hashing) are upstream's
to own, not ours — a key reason to run it rather than port it.

**Slim packaging via `buildIdentityService`.** `@fonoster/identity` exports
`buildIdentityService(config)`; we wrap it in a thin `@grpc/grpc-js` server (a small
`mods/identity-service` workspace package with a Dockerfile) instead of running the heavy
`fonoster/apiserver` image. Because the npm package publishes only `dist` (its `schema.prisma`
and `migrations/` are not included), we **vendor** Identity's `schema.prisma` and `migrations/`
from upstream to provision the Identity database. _Fallback:_ if vendoring proves brittle across
versions, run the official `fonoster/apiserver` image for the Identity endpoint instead — the
generated client and everything above it are unaffected.

**Generate the client from the proto.** Vendor `identity.proto` and generate TypeScript stubs
(`@grpc/proto-loader` + ts types, or `ts-proto`) into an internal `identity-client`. This is the
"SDK" Fonoster doesn't ship. The apiserver exposes it through the tRPC context as a service.

**Token verification in the apiserver.** On login, Identity returns RS256 id/access/refresh
tokens. The apiserver fetches Identity's public key via `GetPublicKey` (cached) and verifies the
access token locally on each request, populating the context with the user, the active workspace
(`accessKeyId`, `WO…`), and the role from the token claims. No per-request round-trip to Identity
for auth.

**Workspace = tenant.** The active workspace's `accessKeyId` is the tenant key. A
`workspaceProcedure` (built on `protectedProcedure`) requires a verified user and an active
workspace, resolves the caller's membership/role, and enforces role-based access. Future domain
resources will carry the workspace `accessKeyId`.

**Active-workspace selection.** A logged-in user may belong to several workspaces. The client
sends the chosen workspace via a request header; the apiserver validates membership before
honoring it. (Identity's access token is per-workspace on exchange; refining the exact
access-token-per-workspace flow is an implementation detail of the auth router.)

**Dev email via Mailpit.** A Mailpit container in Compose captures invite/verification emails;
Identity's SMTP config points at it. Real provider config is env-driven and deferred.

## Risks / Trade-offs

- **Vendored schema/migrations drift from `@fonoster/identity` version** → Pin the package
  version and vendor the matching `schema.prisma`/`migrations`; document the version. Fallback to
  the official image removes this risk if needed.
- **gRPC client/codegen maintenance** → Keep the proto vendored and regenerate via a script;
  the surface we use is small (auth, workspaces, members, public key).
- **Two databases now (app + identity)** → Acceptable; they are separate concerns. Both run in
  Compose locally.
- **Secret/key management (RS256 keypair, encryption key)** → Dev keys generated and gitignored;
  production keys via environment/secret store, documented in `.env.example`.

## Migration Plan

Greenfield (no users yet). Rollout: (1) add Identity service + its Postgres + Mailpit to Compose
with generated dev keys; (2) vendor proto + generate client; (3) apiserver auth/workspaces
routers + verified context + `workspaceProcedure`; (4) console auth flows. Rollback = revert; the
foundation's public endpoints keep working (auth gates are additive).

## Open Questions

- Exact mapping of "active workspace" to Identity token exchange (single access token re-scoped
  per workspace vs. per-workspace exchange) — settle when implementing the auth router.
- Whether to persist a lightweight local mirror of user/workspace for joins, or always read from
  Identity — defer until the first domain change needs workspace-scoped queries.
