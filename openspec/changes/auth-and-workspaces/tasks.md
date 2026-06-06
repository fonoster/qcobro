## 1. Identity service (slim packaging)

- [x] 1.1 Create `mods/identity-service`: a thin `@grpc/grpc-js` server that serves `buildIdentityService(config)` from `@fonoster/identity` (pinned version)
- [x] 1.2 Vendor the matching `schema.prisma` from upstream Identity (0.18.2) to provision its database via `prisma db push`
- [ ] 1.3 Add a Dockerfile for the Identity service and wire it into `compose.yaml` with its own PostgreSQL database _(files written; Docker-up verification pending)_
- [ ] 1.4 Add a Mailpit service to `compose.yaml`; point Identity SMTP at it _(written; verified once 1.3 runs)_
- [x] 1.5 Generate dev RS256 key pair + field-encryption key (gitignored); document all Identity env vars in `.env.example`
- [x] 1.6 Verify the Identity service starts, provisions its schema, and answers a `GetPublicKey` call _(verified via local run; Docker run pending under 1.3)_

## 2. Identity gRPC client (the missing SDK)

- [x] 2.1 Vendor `identity.proto` into the apiserver and load it via `@grpc/proto-loader` to produce client stubs
- [x] 2.2 Create an `identity-client` module (typed promise wrappers) that connects to the Identity service from config
- [x] 2.3 Expose the Identity client through the apiserver tRPC context as a service (verified: `health.identity` → `GetPublicKey`)

## 3. Authentication (apiserver)

- [x] 3.1 Add Zod schemas in `@qcobro/common` for sign-up, login, refresh
- [x] 3.2 Add an `auth` router: sign-up (CreateUser), login (ExchangeCredentials), refresh (ExchangeRefreshToken), logout (client-side; Identity 0.18.2 has no RevokeToken)
- [ ] 3.3 Add password-reset and contact-verification procedures (SendResetPasswordCode/ResetPassword, SendVerificationCode/VerifyCode)
- [x] 3.4 Verify login returns tokens and bad credentials return an unauthorized-category error

## 4. Authorization & context (apiserver)

- [x] 4.1 Fetch and cache Identity's public key via `GetPublicKey`; verify the RS256 access token per request
- [x] 4.2 Populate the tRPC context with the verified user, active workspace (`accessKeyId`), and role (active workspace selected via request header, membership-validated)
- [x] 4.3 Add `protectedProcedure` (auth required), `workspaceProcedure` (active-workspace membership required), and `adminProcedure` (owner/admin) with role checks
- [ ] 4.4 Verify unauthenticated/non-member/insufficient-role requests are rejected (unauthenticated verified; non-member/role verified in Group 5 once workspace endpoints exist)

## 5. Workspaces (apiserver)

- [ ] 5.1 Add a `workspaces` router: create, list, get, update (delegating to Identity)
- [ ] 5.2 Add membership procedures: invite-with-role, resend invitation, accept invitation, list members, remove member
- [ ] 5.3 Enforce owner/admin-only actions via `workspaceProcedure` role checks
- [ ] 5.4 Verify invite creates a pending membership and the email is captured by Mailpit

## 6. Console auth (webapp)

- [ ] 6.1 Add sign-up and login pages wired to the auth router; store tokens and attach the access token to tRPC requests
- [ ] 6.2 Add a "create your first workspace" flow and a current-workspace indicator/switcher
- [ ] 6.3 Add an invite-acceptance entry point (accept via emailed link)
- [ ] 6.4 Add route guards: unauthenticated users are redirected to login; authenticated users without a workspace are prompted to create one
- [ ] 6.5 All new copy goes through the i18n layer

## 7. Verification

- [ ] 7.1 End-to-end (local): sign up → log in → create workspace → invite a member (email in Mailpit) → accept → appears in members
- [ ] 7.2 `npm run build`, `typecheck`, `lint`, and `format:check` pass across the workspace
