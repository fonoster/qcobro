## 1. Package scaffold

- [x] 1.1 Create `mods/sdk` with `package.json` (`@qcobro/sdk`, `"type": "module"`, `exports` → `./dist/index.js`), mirroring `@qcobro/common` scripts (`build`, `clean`, `typecheck`, `test`)
- [x] 1.2 Add `tsconfig.json` extending the root config (`outDir: dist`, `rootDir: src`, exclude `*.test.ts`); wire the package into the Lerna/workspace build order
- [x] 1.3 Add dependencies: `@qcobro/common`, `@trpc/client`, `zod`; type-only dep on `@qcobro/apiserver` for `AppRouter`; dev deps `tsx`, `typescript`, `typedoc`, `typedoc-plugin-markdown`
- [x] 1.4 Create `src/index.ts` barrel exporting the public surface (`Client`, types)

## 2. Client core (sdk-client)

- [x] 2.1 Implement `Client` constructor: accept `{ endpoint, fetch? }`; build an internal `createTRPCClient<AppRouter>()` with an `httpBatchLink` whose `headers()` reads the client's current token + workspace
- [x] 2.2 Hold auth state in memory: `accessToken`, `refreshToken`, `activeWorkspace`; expose `getTokens()`/`setTokens()` and `useWorkspace(accessKeyId)`
- [x] 2.3 Implement `login({ email, password })` → call `auth.login`, store tokens, return them; implement `refresh()` → call `auth.refresh`, replace access token
- [x] 2.4 Ensure header injection is dynamic (token/workspace changes after construction apply to subsequent calls); attach `Authorization: Bearer` and `x-workspace` only when set
- [x] 2.5 Let transport/auth errors (`TRPCClientError`) propagate with context intact

## 3. Portfolios namespace (sdk-portfolios)

- [x] 3.1 Implement `client.portfolios` with `list`, `get`, `create`, `update`, `delete`, `listAccounts`, `syncAccounts`, each delegating to the matching tRPC proxy procedure
- [x] 3.2 Reuse `@qcobro/common` schemas for validation (`createPortfolioSchema`, `updatePortfolioSchema`, `deletePortfolioSchema`, `syncAccountsInputSchema`); add minimal local schemas for the inline-input ops (`list`, `get`, `listAccounts`)
- [x] 3.3 Validate input before each call; throw the shared `ValidationError` on failure and guarantee no request is sent
- [x] 3.4 Type all method results from `AppRouter` (no duplicated result types)

## 4. Docs (TypeDoc)

- [x] 4.1 Add `typedoc.json` (entry `src/index.ts`, markdown plugin, output `docs/`)
- [x] 4.2 Add `"docs": "typedoc"` script; write TSDoc comments on `Client` and every public portfolios method
- [x] 4.3 Add a short `README.md` for the package: install, authenticate, select workspace, manage portfolios; note in-memory tokens + Node ≥18 `fetch` requirement
- [x] 4.4 Verify `npm run docs` emits a markdown API reference

## 5. Tests

- [x] 5.1 Unit: `Client` attaches bearer + workspace headers; header changes after construction apply (stub the transport/fetch)
- [x] 5.2 Unit: validation-failure case — a portfolios method with invalid input throws `ValidationError` and the transport is never called
- [x] 5.3 Unit: each portfolios method delegates to the correct proxy procedure with the validated input (stubbed transport)
- [x] 5.4 Integration/e2e: golden path against a running apiserver (or a typed mock router) — login → useWorkspace → create → list → syncAccounts → listAccounts; assert typed results
- [x] 5.5 Run repo `lint`, `typecheck`, and `test`; all green

## 6. API-key authentication (sdk-client)

- [x] 6.1 **Upstream:** add `exchangeApiKey(accessKeyId, accessKeySecret)` to `@fonoster/identity-client` wrapping the existing `ExchangeApiKey` gRPC, then rebuild the package
- [x] 6.2 Add `apiKeyLoginSchema` (+ `ApiKeyLoginInput`) to `@qcobro/common`
- [x] 6.3 Add public `auth.exchangeApiKey` procedure to the apiserver, delegating to `ctx.identity.exchangeApiKey`
- [x] 6.4 Add `client.loginWithApiKey({ accessKeyId, accessKeySecret })` to the SDK; store tokens like `login()`
- [x] 6.5 Document API-key auth in the README + TSDoc
- [x] 6.6 Tests: API-key login stores tokens; invalid secret rejected; API-key → workspace-scoped call end to end
- [x] 6.7 Re-run repo `lint`, `typecheck`, `test` green (requires 6.1)

## 7. Automatic token refresh (sdk-client)

- [x] 7.1 Add a `Client.request(fn)` wrapper that refreshes once + replays on `UNAUTHORIZED`, single-flight across concurrent failures, with `autoRefresh` option (default on)
- [x] 7.2 Route all `portfolios` resource calls through the wrapper (validation stays before it)
- [x] 7.3 Tests: expired→refresh→replay succeeds; concurrent calls refresh once; failed refresh surfaces original error; disabled = no refresh
- [x] 7.4 Document auto-refresh in README + TSDoc; update sdk-client spec + design
- [x] 7.5 Re-run repo `lint`, `typecheck`, `test` green
