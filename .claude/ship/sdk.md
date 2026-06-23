# Ship checkpoint — sdk

Started: 2026-06-23
Current stage: DONE — archived 2026-06-23

**Scope:** A new `@qcobro/sdk` package (`mods/sdk`) — a developer-friendly, isomorphic TypeScript
SDK wrapping the apiserver tRPC API behind a namespaced `Client`. This ship covers **portfolios
only, including account synchronization** (`list/get/create/update/delete/listAccounts/syncAccounts`),
plus the minimal auth/workspace plumbing needed to make authenticated calls. Docs via TypeDoc
markdown. Other routers deferred to follow-up ships.

**Decisions (from user):** Namespaced client · Isomorphic (Node+browser via fetch) · Portfolios-only
· TypeDoc markdown. Reuse `@qcobro/common` schemas + `AppRouter` type; no server changes.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (not relevant — no UI) · Storybook: yes (not
relevant — no components) · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                    |
| :-- | :-------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change `sdk` created + validated (proposal/design/specs/tasks). Capabilities: sdk-client, sdk-portfolios.                                                                                                                                                                                                |
| 1   | Design (Pencil) | skipped | SDK is a code package with no UI surface — nothing to design in Pencil.                                                                                                                                                                                                                                  |
| 2   | Spec reconcile  | done    | Specs authored this session from finalized decisions; no design drift to reconcile. `openspec validate sdk` = valid.                                                                                                                                                                                     |
| 3   | Build           | done    | `mods/sdk` (`@qcobro/sdk`): namespaced `Client` (credentials + API-key auth, workspace/header injection) + `client.portfolios` (7 ops), shared-schema validation, isomorphic fetch, TypeDoc markdown. API-key path spans identity-client (upstream) → common → apiserver → SDK. Build + typecheck clean. |
| 4   | Test            | done    | 19/19 SDK tests (validation-no-request + server-backed golden path + 3 API-key + 4 auto-refresh) over real express+tRPC, no DB. Full repo: lint clean, typecheck 4/4, test 3/3 projects, 0 fail.                                                                                                         |
| 5   | Sync            | done    | Promoted deltas → `openspec/specs/sdk-client/spec.md` + `openspec/specs/sdk-portfolios/spec.md` (both new, all ADDED). Each validates.                                                                                                                                                                   |
| 6   | Archive         | done    | Moved to `openspec/changes/archive/2026-06-23-sdk`. `openspec validate --all` = 22 passed, 0 failed. 34/34 tasks.                                                                                                                                                                                        |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first.

- 2026-06-23 — Reactive auto-refresh folded into the SDK (user choice; placement debated vs upstream).
  Added `Client.request(fn)` wrapper: single-flight refresh + one replay on `UNAUTHORIZED`, `autoRefresh`
  option (default on). Routed portfolios calls through it. +4 tests (19/19). Rationale: interception/
  replay must wrap the SDK→apiserver tRPC path that 401s; identity-client is stateless/off-path. Specs
  - design (D2c) + README updated. Back at Sync gate, green.

- 2026-06-23 — API-key auth folded into the sdk change (user choice). Verified Identity service
  already implements `ExchangeApiKey({accessKeyId,accessKeySecret})→tokens`; proto + service exist.
  Done in-repo: `apiKeyLoginSchema` (common), `auth.exchangeApiKey` (apiserver), `loginWithApiKey`
  (SDK) + README/TSDoc + 3 tests + updated proposal/design/sdk-client spec/tasks. **BLOCKED:** the
  `@fonoster/identity-client` wrapper needs an `exchangeApiKey()` method (task 6.1) but it lives in
  `../fonoster` (out-of-repo); the harness safety classifier denied the edit. Repo won't typecheck
  until 6.1 lands + identity-client rebuilds. Awaiting user approval for the upstream edit.

- 2026-06-23 — Stages 3+4 done. Built `mods/sdk`; all 22 tasks checked. e2e (5.4) implemented as a
  real in-process express+tRPC stub server (true wire-level e2e, resolvers stubbed, no Postgres/
  Identity needed) rather than a live apiserver — Playwright e2e is webapp-UI-only, N/A to a library.
  Resource methods made `async` so validation failures reject (not sync-throw). Paused at Sync gate.
- 2026-06-23 — Stage 2 done: specs match finalized decisions; validated. Stage 1 skipped (no UI).
- 2026-06-23 — Stage 0: created OpenSpec change `sdk` via propose; scope locked to portfolios-only
  per user, namespaced isomorphic client, TypeDoc markdown docs.
