## Why

External integrators (and our own scripts/CLIs) currently have no first-class way to talk to
QCobro: they would have to hand-wire a tRPC client, juggle Identity tokens, and remember the
`x-workspace` header convention. We want a developer-friendly TypeScript SDK — Fonoster-style —
so integrating with QCobro is `npm install @qcobro/sdk`, authenticate, and call typed methods.
This first slice targets the most-requested surface: **managing portfolios, including account
synchronization.**

## What Changes

- New workspace package `mods/sdk`, published as `@qcobro/sdk`, that wraps the apiserver's tRPC
  API behind an ergonomic, namespaced client. Isomorphic (Node + browser via `fetch`).
- A single `Client` that owns connection + auth state: authenticate with email/password **or a
  workspace API key** to obtain Identity tokens, hold/replace the access token, and select an
  active workspace. It transparently attaches the `Authorization: Bearer` and `x-workspace`
  headers to every call.
- **API-key authentication for unattended integrations.** Adds `auth.exchangeApiKey` to the
  apiserver (wrapping Identity's existing `ExchangeApiKey` gRPC) and `client.loginWithApiKey()`
  to the SDK, so server-to-server callers can authenticate with an `accessKeyId` +
  `accessKeySecret` instead of a password. Requires surfacing `exchangeApiKey` on the
  `@fonoster/identity-client` wrapper (the gRPC method already exists).
- A `client.portfolios` namespace with friendly methods mirroring `portfoliosRouter`:
  `list`, `get`, `create`, `update`, `delete`, `listAccounts`, `syncAccounts`. tRPC's
  `.query`/`.mutate` idiom is hidden from callers.
- End-to-end type safety: the SDK consumes the apiserver's `AppRouter` type and reuses
  `@qcobro/common` schemas/types as the single contract source — no duplicated input types.
- Client-side input validation: invalid arguments are rejected via the shared Zod schemas with
  a structured error **before** a request is sent.
- TypeDoc + markdown plugin generates an API reference from TSDoc comments; `npm run docs`
  emits markdown (Fonoster-style docs build).
- **Out of scope (deferred to follow-up ships):** every other router — campaigns,
  agentTemplates, outreach, config, health, profile/workspaces beyond what auth/workspace
  selection requires.

## Capabilities

### New Capabilities

- `sdk-client`: The connection + auth lifecycle of `@qcobro/sdk` — constructing a client against
  an endpoint, authenticating (credentials **or workspace API key**) to obtain/hold tokens,
  selecting an active workspace, transparent header injection, structured surfacing of
  auth/transport errors, and isomorphic runtime support.
- `sdk-portfolios`: The `client.portfolios` resource — typed methods for listing, reading,
  creating, updating, deleting portfolios and listing/synchronizing their accounts, with
  client-side validation of inputs against the shared schemas.

### Modified Capabilities

<!-- None. The SDK consumes the existing tRPC surface; no server requirement changes. -->

## Impact

- **New package:** `mods/sdk` (`@qcobro/sdk`) added to the npm workspaces / Lerna build.
- **Dependencies (new):** `@qcobro/common`, `@qcobro/apiserver` (type-only, for `AppRouter`),
  `@trpc/client`, `zod`; dev: `typedoc`, `typedoc-plugin-markdown`, the repo's test runner.
- **Server change (auth):** adds one public procedure `auth.exchangeApiKey` to the apiserver and
  an `apiKeyLoginSchema` to `@qcobro/common`. The rest of the tRPC API is consumed as-is.
- **Upstream change:** `@fonoster/identity-client` gains an `exchangeApiKey(accessKeyId,
accessKeySecret)` method surfacing the Identity service's existing `ExchangeApiKey` gRPC call.
- **Docs:** a generated API reference (markdown) becomes a build output of the new package.
