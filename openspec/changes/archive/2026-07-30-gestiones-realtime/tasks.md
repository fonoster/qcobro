## 1. Design check

- [x] 1.1 Check Pencil (`pencil.pen`) for the Gestiones list and Gestión detail screens for
      any live-update affordance (connection indicator, "new" badge/highlight). Record the
      finding — either "no change needed" (explicit) or design the addition following
      existing Pencil conventions (modal-over-page pattern, etc.).
      **Finding: no Pencil change needed.** Checked the Gestiones list frame and all five
      channel-specific Gestión-detail panels; no existing "connection status"/"live" affordance
      anywhere in the console to mirror, and the realtime behavior here is signal-only refetch
      (existing rendering already handles new/changed data once refetched). See ship
      checkpoint decision log for the full trace.

## 2. Apiserver — event bus and Prisma extension

- [x] 2.1 Add `mods/apiserver/src/services/contactLogEvents.ts`: `EventEmitter`-backed bus,
      `emitContactLogChanged({ id, workspaceRef })`, and a typed way to subscribe.
- [x] 2.2 Add a Prisma Client Extension in `mods/apiserver/src/db.ts` wrapping
      `accountContactLog` and `paymentPromise` `create`/`update`/`upsert` operations: after a
      successful write, resolve the owning `workspaceRef` via the base (non-extended) client
      and emit the change signal.
      Resolves via the write's own `portfolioAccountId` (not by re-reading the row that was
      just written) — the real write paths run inside an interactive `$transaction`, and a
      lookup on the just-written row from a separate connection would race the transaction's
      commit and silently drop the signal. Found and fixed via a live e2e run; see task 6.4.
- [x] 2.3 Add `ws` and `@types/ws` as explicit dependencies in `mods/apiserver/package.json`.

## 3. Apiserver — WebSocket transport and subscription procedure

- [x] 3.1 Refactor `mods/apiserver/src/trpc/context.ts`: extract the shared
      token/workspace → `{ user, workspace, timezone, currency }` resolution into a helper
      usable by both the existing Express `createContext` (reads headers) and a new
      `createWSContext` (reads `opts.info.connectionParams`).
- [x] 3.2 Mount `applyWSSHandler` from `@trpc/server/adapters/ws` on the apiserver's HTTP
      server at `/trpc-ws` in `mods/apiserver/src/index.ts` (capture the `http.Server` from
      `app.listen`).
- [x] 3.3 Add `onChange` subscription to `contactLogRouter` in
      `mods/apiserver/src/trpc/routers/campaigns.ts`: optional `{ id? }` input, ownership
      check when `id` is set, async-generator using `events.on(bus, EVENT, { signal })`
      filtered to the caller's workspace (and `id` when set).

## 4. Webapp — realtime client plumbing

- [x] 4.1 Update `mods/webapp/src/lib/trpc.ts`: add `createWSClient` (lazy, `connectionParams`
      reading token/workspace from `localStorage`) and a `splitLink` routing
      `subscription`-type operations to `wsLink`, everything else to the existing
      `httpBatchLink`.
- [x] 4.2 Add a subscription hook (`mods/webapp/src/lib/useContactLogRealtime.ts`) that wraps
      `trpc.campaigns.contactLog.onChange.useSubscription` and invalidates
      `campaigns.contactLog.list` (no id) or `campaigns.contactLog.get` (with id) on each
      signal. Callbacks are `useCallback`-stabilized so the WS subscription isn't torn down
      and reopened on unrelated re-renders of the host component.
- [x] 4.3 Wire the hook into `mods/webapp/src/pages/Gestiones.tsx` (list-level, unfiltered)
      and `mods/webapp/src/pages/GestionDetail.tsx`'s `GestionDetailContent` (id-filtered).
- [x] 4.4 Apply any Pencil-identified UI addition from task 1.1, with all new copy routed
      through `mods/webapp/src/lib/i18n.tsx`. N/A — task 1.1 found no UI addition needed.

## 5. Infra

- [x] 5.1 Add `/trpc-ws` to `mods/webapp/vite.config.ts`'s dev server proxy with `ws: true`.
- [x] 5.2 Add a `/trpc-ws` location block to `config/nginx.conf` with `Upgrade`/`Connection`
      headers for WebSocket passthrough.
- [x] 5.3 Confirm `config/envoy.yaml`'s existing `/trpc` prefix match covers `/trpc-ws`
      (no functional change expected; add a comment noting it if useful).

## 6. Tests

- [x] 6.1 Unit tests for the Prisma extension's workspace resolution + emit behavior
      (including a case where the write isn't a covered model/operation and nothing emits).
      `mods/apiserver/src/services/contactLogEvents.test.ts` — 8 cases, including a regression
      test locking in the portfolioAccountId-based resolution (task 2.2's fix).
- [x] 6.2 Unit tests for the `onChange` subscription's filtering logic (workspace scoping, id
      scoping, ownership rejection). `mods/apiserver/src/trpc/routers/campaigns.onChange.test.ts`
      — 4 cases. No new validated function was introduced for this change (the subscription
      and the Prisma extension are framework glue/infra, not input-validating business
      operations per CLAUDE.md's validated-function guidance), so there is no separate
      validation-failure case to add beyond the existing pattern's tests.
- [x] 6.3 Webapp unit/integration test for the subscription hook's invalidate-on-signal
      behavior. **Decision: skipped, deliberately, not silently.** This repo has zero webapp
      unit-test infrastructure today (no vitest/jest, no `test` script in
      `mods/webapp/package.json`, no RTL) — introducing one is a toolchain decision out of
      scope for issue #60. Coverage of the exact same behavior (subscribe → invalidate →
      re-render) is instead provided by the e2e test (6.4), which is a strictly stronger test
      of this hook than an isolated unit test would be, run against the real transport.
- [x] 6.4 e2e (Playwright): `e2e/gestiones-realtime.spec.ts`. Golden path implemented as: open
      the Gestiones list (subscription live) → seed a gestión via the external contact-log
      ingress (a channel the open page never touches) → assert the row streams in without
      reload → open its detail panel → from a second page in the same browser context (a
      stand-in for a second operator), resolve the linked payment promise through the normal
      worklist UI → assert the first page's still-open detail panel updates in place.
      Validated against a real, live dev stack (docker compose backing services + apiserver +
      vite dev server, on alternate local ports to avoid colliding with another agent's stack
      in this shared sandbox) — real WebSocket connections, real Prisma writes, real
      subscription delivery observed end-to-end. This run caught and drove the fix in task
      2.2 (the transaction-visibility bug). Confirmed no regression in 7 other existing e2e
      specs (gestiones-channels, payment-promises, manual-outreach, ai-insights,
      campaigns-core ×2, console-refinements) run against the same stack. CI runs the full
      suite (including this spec) as the authoritative, isolated-environment check.
- [x] 6.5 Run `npm run lint`, `npm run typecheck`, `npm run test` (workspace-scoped) and get
      them green. Lint: clean. Typecheck: clean across all 5 packages (common, apiserver,
      webapp, sdk, mcp). apiserver unit tests: 295/295 passing. webapp has no `test` script
      (see 6.3).

## 7. Spec sync and archive

- [x] 7.1 Sync delta specs (`account-contact-log`, `realtime-streaming`) into
      `openspec/specs/`.
- [x] 7.2 Archive the change.
