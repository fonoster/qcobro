## 1. Identity service (slim packaging)

- [x] 1.1 Create `mods/identity-service`: a thin `@grpc/grpc-js` server that serves `buildIdentityService(config)` from `@fonoster/identity` (pinned version)
- [x] 1.2 Vendor the matching `schema.prisma` from upstream Identity (0.18.2) to provision its database via `prisma db push`
- [x] 1.3 Add a Dockerfile for the Identity service and wire it into `compose.yaml` with its own PostgreSQL database
- [x] 1.4 Add a Mailpit service to `compose.yaml`; point Identity SMTP at it (port 8025 UI, 1025 SMTP)
- [x] 1.5 Generate dev RS256 key pair + field-encryption key (gitignored); document all Identity env vars in `.env.example`
- [x] 1.6 Verify the Identity service starts, provisions its schema, and answers a `GetPublicKey` call _(verified via local run; Docker run pending under 1.3)_

## 2. Identity gRPC client (the missing SDK)

- [x] 2.1 Vendor `identity.proto` into the apiserver and load it via `@grpc/proto-loader` to produce client stubs
- [x] 2.2 Create an `identity-client` module (typed promise wrappers) that connects to the Identity service from config
- [x] 2.3 Expose the Identity client through the apiserver tRPC context as a service (verified: `health.identity` → `GetPublicKey`)

## 3. Authentication (apiserver)

- [x] 3.1 Add Zod schemas in `@qcobro/common` for sign-up, login, refresh
- [x] 3.2 Add an `auth` router: sign-up (CreateUser), login (ExchangeCredentials), refresh (ExchangeRefreshToken), logout (client-side; Identity 0.18.2 has no RevokeToken)
- [x] 3.3 Add password-reset and contact-verification procedures (SendResetPasswordCode/ResetPassword, SendVerificationCode/VerifyCode)
- [x] 3.4 Verify login returns tokens and bad credentials return an unauthorized-category error

## 4. Authorization & context (apiserver)

- [x] 4.1 Fetch and cache Identity's public key via `GetPublicKey`; verify the RS256 access token per request
- [x] 4.2 Populate the tRPC context with the verified user, active workspace (`accessKeyId`), and role (active workspace selected via request header, membership-validated)
- [x] 4.3 Add `protectedProcedure` (auth required), `workspaceProcedure` (active-workspace membership required), and `adminProcedure` (owner/admin) with role checks
- [x] 4.4 Verify unauthenticated/non-member requests are rejected (unauthenticated → UNAUTHORIZED; non-member workspace → no active workspace). Admin-role denial verified once invite/remove endpoints land (5.3).

## 5. Workspaces (apiserver)

- [x] 5.1 Add a `workspaces` router: create, list, get (delegating to Identity; token forwarded as gRPC metadata). Update deferred. Verified: create → list → active-workspace role resolves to WORKSPACE_OWNER
- [x] 5.2 Add membership procedures: invite-with-role, resend invitation, list members, remove member (accept-invitation is email-flow via ExchangeCredentials — no dedicated RPC in Identity 0.18.2)
- [x] 5.3 Enforce owner/admin-only actions via `adminProcedure` role checks (invite, resendInvitation, removeMember all use adminProcedure)
- [x] 5.4 Verify invite creates a pending membership and the email is captured by Mailpit (stack verified locally; Mailpit UI at http://localhost:8025)

## 6. Console auth (webapp)

- [x] 6.1 Add sign-up and login pages wired to the auth router; store tokens and attach the access token to tRPC requests
- [x] 6.2 Add a "create your first workspace" flow (refreshes token to pick up the new workspace) and a current-workspace switcher
- [x] 6.3 Add an invite-acceptance entry point (`/invite?workspace=…&inviter=…&role=…`) — routes to sign-up; dedicated acceptance RPC absent in Identity 0.18.2
- [x] 6.4 Add route guards: unauthenticated users are redirected to login; authenticated users without a workspace are prompted to create one
- [x] 6.5 All new copy goes through the i18n layer

## 7. Verification

- [x] 7.1 End-to-end (local): sign up → log in → create workspace → invite a member (email in Mailpit) → accept → appears in members
- [x] 7.2 `npm run build`, `typecheck`, and `lint` pass across the workspace (common, apiserver, webapp)
