## Why

QCobro needs accounts, authentication, and multi-tenancy before any real feature is usable: anyone should be able to sign up, create a workspace, invite teammates with a role, and have every action scoped to their workspace. Rather than build identity from scratch, we reuse **Fonoster Identity** — a proven, MIT-licensed module with exactly this model (users, workspaces, members, roles, RS256 JWTs, RBAC). It has no client SDK, so part of this change is closing that gap.

## What Changes

- **Run Fonoster Identity as a service.** Package a slim Identity gRPC service from the `@fonoster/identity` package (its `buildIdentityService(config)` export) with its own PostgreSQL database, added to local Docker Compose. (Avoids the heavy monolithic `fonoster/apiserver` image while reusing all upstream logic.)
- **Generate the missing client.** Generate TypeScript gRPC client stubs from the upstream `identity.proto` (package `fonoster.identity.v1beta2`) into a small internal client used by the apiserver — this is the "SDK" Fonoster doesn't ship.
- **Authentication.** apiserver tRPC procedures for sign-up (`CreateUser`), login (`ExchangeCredentials` → id/access/refresh tokens), token refresh (`ExchangeRefreshToken`), logout (`RevokeToken`), and password reset / contact verification.
- **Token-verified context.** Replace the foundation's nullable-`user` seam: verify the access JWT using Identity's public key (fetched via `GetPublicKey`) and populate the tRPC context with the authenticated user, the active workspace (`accessKeyId`), and role.
- **Workspaces (multi-tenancy).** Procedures to create/list/get/update workspaces, invite members with a role, accept/resend invitations, list members, and remove members — backed by Identity's workspace operations.
- **Authorization.** A workspace-scoped procedure layer that requires an authenticated user, resolves their membership/role in the active workspace, and enforces role-based access; domain resources will carry the workspace `accessKeyId` as their tenant key.
- **Console auth (minimal).** Sign-up, login, and "create your first workspace" flows in the webapp, plus an invite-acceptance entry point and a workspace indicator — enough to exercise the system end to end. Richer member-management UI is deferred.

## Capabilities

### New Capabilities

- `identity-service`: Running Fonoster Identity as a standalone gRPC service (slim packaging, own database, configuration, key management) and the generated gRPC client the apiserver uses to reach it.
- `authentication`: Sign-up, login, token lifecycle (issue/refresh/revoke), and password reset / contact verification, exposed as apiserver procedures over the Identity client.
- `authorization`: Token verification, the authenticated/ workspace-scoped tRPC context, and role-based access enforcement.
- `workspaces`: Workspace lifecycle and membership — create, invite (with role), accept/resend, list members, remove — as the multi-tenancy boundary.

### Modified Capabilities

- `api-foundation`: The tRPC context now resolves a verified user, active workspace, and role from the access token (the foundation reserved a nullable `user`); a workspace-scoped procedure is added alongside the existing public/protected procedures.

## Impact

- **Infrastructure:** new Identity gRPC service + its PostgreSQL database in Docker Compose; an RS256 key pair and a field-encryption key for Identity; SMTP (or a dev mailer) for invite/verification emails; new env vars documented in `.env.example`.
- **Dependencies:** `@fonoster/identity` (+ its peers) for the service package; `@grpc/grpc-js` and proto-loader/codegen for the client; a JWT verification library in the apiserver.
- **Code:** new apiserver routers (auth, workspaces) and context changes; a generated identity-client module; webapp auth pages and routing/guards.
- **Out of scope (deferred):** OAuth2 / social login, API-key management UI, MFA enforcement, custom roles beyond Identity's built-ins, and full member-management UI polish.
