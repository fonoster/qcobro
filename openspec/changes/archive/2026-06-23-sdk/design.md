## Context

QCobro's API is a tRPC server (`mods/apiserver`) over Prisma/PostgreSQL. The webapp talks to it
via `@trpc/react-query`, reaching into `localStorage` for the access token and active workspace.
There is no packaged way for an external integrator to do the same: they would reimplement the
auth dance (Fonoster Identity tokens), the `x-workspace` header convention, and the tRPC wire
format by hand.

`@fonoster/sdk` is the model we want to emulate: a small, hand-written client that hides the
transport, manages credentials, and exposes resource namespaces with friendly method names —
plus a generated API reference. This change builds the equivalent for QCobro, scoped to a single
vertical slice (**portfolios**) to prove the pattern end-to-end before widening it.

Contracts already live in `@qcobro/common` (Zod schemas + inferred types) and the router type is
exported as `AppRouter` from `@qcobro/apiserver`. The SDK is therefore a thin, well-typed facade —
not a re-derivation of the API.

## Goals / Non-Goals

**Goals:**

- A new `@qcobro/sdk` package (`mods/sdk`) that an integrator can `npm install` and use in Node or
  the browser.
- One `Client` that owns the connection + auth lifecycle: `login`, hold/replace access token,
  `useWorkspace`, and transparent injection of `Authorization` + `x-workspace` headers.
- A `client.portfolios` namespace whose methods map 1:1 to `portfoliosRouter` operations, returning
  fully-typed results inferred from `AppRouter` — no `.query`/`.mutate` leakage.
- Client-side validation: inputs are checked against the shared `@qcobro/common` schemas before a
  request leaves the process, throwing a structured error on failure.
- A `npm run docs` that emits a markdown API reference via TypeDoc.

**Non-Goals:**

- Wrapping any router other than `portfolios` (+ the minimal `auth` surface needed to authenticate).
  Campaigns, agentTemplates, outreach, config, health, etc. are explicit follow-ups.
- Token persistence / storage strategy (the caller decides where tokens live; the SDK just holds
  the current one in memory and exposes setters/getters).
- Pre-emptive refresh based on token `exp` (refreshing before a call fails). v1 refreshes
  reactively on `UNAUTHORIZED`; reading the JWT `exp` to refresh ahead of time is a later concern.
- Server-side changes. The apiserver is consumed as-is.
- React Query / hooks. This SDK is framework-agnostic; the webapp keeps its existing `@trpc/react-query` setup.

## Decisions

### D1. Hand-written namespaced facade over a typed tRPC proxy client

Internally the `Client` builds a `createTRPCClient<AppRouter>()` (from `@trpc/client`) with an
`httpBatchLink` whose `headers()` callback reads the client's current token + workspace. Each public
method (`client.portfolios.create(...)`) calls the corresponding proxy procedure
(`proxy.portfolios.create.mutate(...)`) under the hood.

- _Why:_ the proxy gives end-to-end types for free from `AppRouter`; the hand-written namespace gives
  the friendly surface and a place to attach TSDoc + client-side validation. Best of both.
- _Alternatives:_ (a) re-export the raw proxy — rejected: leaks `.query`/`.mutate`, no docs anchor,
  no pre-flight validation. (b) Codegen from the router — rejected: heavier machinery than a
  single-resource slice warrants.

### D2. Auth state lives on the Client, headers injected transparently

`Client` holds `accessToken`, `refreshToken`, and `activeWorkspace` in memory. `login({email,password})`
calls the public `auth.login` procedure, stores the returned tokens, and returns them.
`useWorkspace(accessKeyId)` sets the active workspace. The `httpBatchLink.headers()` callback emits
`Authorization: Bearer <token>` and `x-workspace: <accessKeyId>` whenever they are set.

- _Why:_ mirrors how the webapp already authenticates, but packaged. Keeping headers in the link
  callback (not baked at construction) means a `login()` or `useWorkspace()` after construction
  applies to subsequent calls without rebuilding the client.
- _Trade-off:_ tokens are in-memory only; persistence is the caller's job (documented).

### D2b. API-key authentication for unattended integrations

In addition to `login({email,password})`, the `Client` offers
`loginWithApiKey({accessKeyId, accessKeySecret})`. It calls a new public apiserver procedure
`auth.exchangeApiKey`, which delegates to the Identity service's existing `ExchangeApiKey` gRPC
(returning the same id/access/refresh token triple), then stores the tokens exactly like
`login()`. The input is validated against a new shared `apiKeyLoginSchema` in `@qcobro/common`.

The Identity **service** already implements API-key issuance and exchange; the only gap is the
`@fonoster/identity-client` wrapper, which gains a thin `exchangeApiKey(accessKeyId,
accessKeySecret)` method (the gRPC stub already exposes the call).

- _Why:_ password sessions are wrong for machines. API keys are the standard server-to-server
  credential, are already a first-class Identity concept (workspaces are keyed by `accessKeyId`),
  and reuse the same token/refresh/header machinery once exchanged.
- _Alternative considered:_ treat a long-lived refresh token as a pseudo-key — rejected: refresh
  tokens aren't designed as durable, revocable, per-integration credentials; real API keys are.

### D2c. Reactive auto-refresh lives in the SDK, at the transport boundary

The `Client` wraps each resource request in a `request(fn)` helper: it runs `fn`, and on an
`UNAUTHORIZED` error (and only when a refresh token is held and auto-refresh is enabled) performs
a single-flight `refresh()` and replays `fn` exactly once. Concurrent failures share one in-flight
refresh; a failed refresh re-throws the original error; a second failure is not retried.

- _Why here, not upstream:_ the refresh **primitive** (`exchangeRefreshToken`) already lives in
  `@fonoster/identity-client`, and the SDK refreshes via the apiserver's `auth.refresh` tRPC
  procedure. The **interception/replay** must wrap the transport that actually returns the 401 —
  here, the SDK→apiserver tRPC path. `identity-client` is stateless, server-side, and not on that
  path, so it cannot observe or replay the failing call. Keeping orchestration in the SDK also
  avoids cross-repo release coupling.
- _Why a `request` wrapper, not a custom tRPC link:_ a method-level wrapper is dependency-free
  (no `@trpc/server` observable import), trivially unit-testable, and correct under batching since
  it sees the per-operation parsed error. A custom link is the heavier alternative if we later
  need pre-emptive refresh or non-resource calls covered.

### D3. Client-side validation reuses `@qcobro/common` schemas

Before delegating to the proxy, each portfolio method `parse`s its argument with the matching shared
schema (`createPortfolioSchema`, `syncAccountsInputSchema`, …). On failure it throws the repo's
structured `ValidationError` (from `@qcobro/common`), consistent with server-side behavior.

- _Why:_ fail fast with a clear, structured error and no wasted round-trip; single source of truth for
  the contract. `list`/`get`/etc. that the server defines with inline `z.object(...)` get a small
  matching schema defined in the SDK (kept minimal; behavior, not new contract).
- _Alternative:_ trust the server to validate — rejected: worse DX, network cost for obviously-bad input.

### D4. Isomorphic via the platform `fetch`

The package targets environments with a global `fetch` (Node ≥18, modern browsers). The tRPC
`httpBatchLink` uses `fetch` by default; the client accepts an optional `fetch` override for exotic
runtimes. No `node-fetch`/`cross-fetch` dependency.

- _Why:_ smallest dependency surface; `fetch` is now ubiquitous. _Risk_ below covers old runtimes.

### D5. TypeDoc + markdown plugin for docs

`typedoc` with `typedoc-plugin-markdown`, driven by a `typedoc.json`, emits a markdown API reference
from TSDoc comments on `Client` and the portfolios namespace. `npm run docs` is the entry point.

- _Why:_ matches Fonoster's approach; markdown is trivial to publish (docs site, repo, wiki).

### D6. Errors are surfaced, not swallowed

Transport/auth failures from tRPC (`TRPCClientError`) propagate as-is (typed), with their HTTP/status
context intact. Unauthenticated or wrong-workspace calls therefore surface the server's `UNAUTHORIZED`/
`FORBIDDEN` error rather than a generic failure. Client-side validation failures throw `ValidationError`.

## Risks / Trade-offs

- **Old runtimes lack global `fetch` (Node <18).** → Document the Node ≥18 requirement; allow a
  `fetch` override in the constructor for callers who must polyfill.
- **Type coupling to `@qcobro/apiserver`.** Importing `AppRouter` pulls a type-only dependency on the
  server package. → Import `AppRouter` as a `type` only (erased at build); the SDK never imports server
  runtime code. Keep the dependency `devDependency` + peer/type-only where the toolchain allows.
- **Inline-schema drift for `list`/`get`/`listAccounts`.** The server defines these inputs inline, so
  the SDK's matching schemas could drift. → Keep them minimal and colocated; the e2e/integration test
  catches contract mismatches against a real router.
- **In-memory tokens surprise callers expecting persistence.** → Call it out in TSDoc + README;
  expose `getTokens()`/`setTokens()` so callers can wire their own storage.

## Migration Plan

Additive: a brand-new package. No existing code changes behavior. Rollout is publishing the package;
rollback is not publishing / removing it. The webapp is untouched and keeps its current tRPC setup.
