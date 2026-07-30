## Context

QCobro's apiserver is a single Express process serving tRPC (`/trpc`, `httpBatchLink`) plus a
handful of REST webhook/ingress endpoints, backed by Prisma/PostgreSQL. There is no streaming
transport today. The Gestiones list (`campaigns.contactLog.list`) and Gestión detail
(`campaigns.contactLog.get`) are plain `useQuery` calls with `staleTime: 0`, refetched only on
navigation/mount or an explicit `utils.invalidate()` after a mutation the page itself made
(e.g. `generateInsight`). Writes to a gestión's row happen from many places: the manual
create path (`createCreateContactLog`), the campaigns engine, the Voz IA webhook
(`ingestVoiceEvent`), email/WhatsApp inbound webhooks, `generateGestionInsight`, and
`resolvePaymentPromise`/`followUpPaymentPromise` for the linked `PaymentPromise`. Any realtime
design must cover all of these without becoming an app-wide event system.

## Goals / Non-Goals

**Goals:**

- Gestiones list and Gestión detail update live when the underlying `AccountContactLog` or a
  linked `PaymentPromise` changes, from any of the write paths above.
- One transport (WebSocket + tRPC subscriptions), reusable later, but wired to exactly these
  two screens now.
- Realtime is additive: the existing query/refetch behavior keeps working unmodified and is
  the fallback the moment a stream can't be established.
- Minimal new surface area to reason about — no per-call-site instrumentation to keep in sync.

**Non-Goals:**

- App-wide realtime (other screens, e.g. Portfolios, Payment Promises worklist) — out of
  scope per the issue; the transport is reusable but not wired elsewhere in this change.
- Pushing full row payloads over the wire (no diffing/merging client-side cache logic).
- Presence, typing indicators, or any other realtime feature beyond "this record changed."
- Horizontal scaling of the event bus (e.g. Redis pub/sub) — apiserver runs as a single
  process today; a multi-instance deployment is a follow-up if/when it happens.

## Decisions

### 1. Signal-only subscriptions, not data-over-the-wire

The subscription emits `{ id }` (gestión id) when something about that gestión (or a linked
payment promise) changed. The client reacts by calling the _same_ `utils.campaigns.contactLog
.list.invalidate()` / `.get.invalidate({ id })` that already exists for the mutation-driven
refetch (e.g. `generateInsight`'s `onSuccess`). This means:

- The realtime path and the fallback path are literally the same code — there's no separate
  "apply realtime patch" logic to keep consistent with the query shape (filters, pagination,
  joins already encoded in `contactLogRouter.list`/`.get`).
- No risk of the stream's shape drifting from the query's shape over time.
- Alternative considered: stream full rows and merge into the React Query cache directly
  (`setQueryData`). Rejected — doubles the shape surface to maintain (the list's `include`,
  the detail's `include`, and the stream payload), and the win (saves one round trip per
  event) isn't worth it for a screen with human-paced update rates.

### 2. One Prisma Client Extension as the single publish point

`mods/apiserver/src/db.ts` gains a `$extends` query-component extension scoped to the
`accountContactLog` and `paymentPromise` models' `create`/`update`/`upsert` operations. After
the underlying write succeeds, the extension resolves the write's owning `workspaceRef`
(`accountContactLog` → `portfolioAccount` → `portfolio.workspaceRef`; for `paymentPromise`,
via its `contactLogId`) using the **base**, non-extended Prisma client (avoids any risk of
re-triggering the extension) and emits `{ id: <contactLogId>, workspaceRef }` on a shared
`EventEmitter` (`src/services/contactLogEvents.ts`).

- Alternative considered: call an explicit `emitContactLogChanged(id)` at the end of every
  function/handler that writes a gestión or payment promise (`createContactLog`,
  `recordOutcome`, `recordPrerecordedOutcome`, `ingestVoiceEvent`, `ingestEmailReply`,
  `ingestWhatsAppMessage`, `generateGestionInsight`, `resolvePaymentPromise`,
  `followUpPaymentPromise`). Rejected as the primary mechanism — nine-plus call sites is a lot
  of surface to keep in sync, and a new write path added later would silently not stream
  unless the author remembered to wire it. The Prisma extension makes "every write to these
  two tables streams" true by construction.
- Trade-off accepted: one extra `findUnique` per contact-log/payment-promise write to resolve
  `workspaceRef`. These are low-frequency, already-multi-query operations (dispatch, webhook
  ingestion) — the added read is not on any latency-sensitive path.

### 3. WebSocket transport, workspace-scoped via `connectionParams`

`applyWSSHandler` from `@trpc/server/adapters/ws` mounts on the same HTTP server
(`app.listen`'s returned `http.Server`) at `/trpc-ws`, separate from the Express `/trpc`
mount. Browsers cannot set custom headers on a WebSocket handshake, so auth/workspace scoping
travels via tRPC's `connectionParams` (sent as the WS client's first message) instead of the
`Authorization`/`x-workspace` headers the HTTP path uses. `createContext` is refactored to a
shared `resolveAuth(token, workspaceHeader)` helper called from both the existing Express
`createContext` (reads `req.headers`) and a new `createWSContext` (reads
`opts.info.connectionParams`), so the two paths can never drift on how a token/workspace
resolves to `ctx.user`/`ctx.workspace`.

### 4. Client: `splitLink` + lazy `wsLink`, subscriptions only

`mods/webapp/src/lib/trpc.ts` adds a `createWSClient` with `connectionParams: () => ({ token,
workspace })` (read fresh from `localStorage` on every connect) and `lazy: { enabled: true,
closeMs: 0 }` — the socket opens only while a subscription is active and closes as soon as
the last one unmounts. `splitLink` routes `subscription`-type operations to `wsLink`, and
everything else keeps using the existing `httpBatchLink`. Lazy mode is what gives correct
behavior across token refresh and workspace switch without extra reconnect plumbing: since
neither screen keeps a subscription open across a workspace switch (the previous screen's
subscription hook unmounts, the new one's connects fresh), each new connection naturally
picks up current `localStorage` state.

- Alternative considered: a long-lived, eagerly-opened WS connection for the whole app
  session. Rejected — conflicts with "scoped to the targeted queries" (issue's explicit
  requirement); would also need manual reconnect wiring on workspace switch/token refresh
  that lazy mode gives for free.

### 5. `contactLogRouter.onChange` subscription, one procedure for both screens

Implemented as an async generator using Node's `events.on(bus, EVENT, { signal })`:

```ts
onChange: workspaceProcedure
  .input(z.object({ id: z.string().optional() }))
  .subscription(async function* ({ ctx, input, signal }) {
    if (input.id) {
      // ownership check once, same scoping as contactLog.get
    }
    for await (const [event] of on(bus, EVENT, { signal })) {
      if (event.workspaceRef !== ctx.workspace.accessKeyId) continue;
      if (input.id && event.id !== input.id) continue;
      yield { id: event.id };
    }
  });
```

Gestiones list subscribes with no `id` (any workspace change is relevant — it may be a new
row or a filter-matching update); Gestión detail subscribes with `id` set. One procedure,
one implementation, matches how `list`/`get` already share the router.

### 6. Fallback behavior

If the WS connection fails to establish (network blocks WS, proxy misconfigured, etc.),
`wsLink`'s underlying `WsClient` retries with backoff but never throws into the app — the
subscription hook only acts on events it receives, and the underlying `useQuery` continues to
behave exactly as it does today (fetch on mount, `staleTime: 0` on navigation). No UI state
depends on the subscription being connected; it purely triggers extra invalidations.

## Risks / Trade-offs

- **[Risk]** Prisma extension's `findUnique` lookup runs even when no client currently has a
  matching subscription open (e.g. no one's on Gestiones right now). → **Mitigation**: the
  event bus emit is O(1) with zero listeners; the extra `findUnique` cost is small and bounded
  by contact-log write volume, not by subscriber count. Acceptable for a single-instance
  deployment; revisit if write volume becomes a concern.
- **[Risk]** Single in-process `EventEmitter` means events don't cross apiserver instances if
  the service is ever scaled horizontally — a client connected to instance A won't see a
  write that landed via instance B. → **Mitigation**: out of scope (apiserver is
  single-instance today per `compose.yaml`); noted as a follow-up for whoever adds horizontal
  scaling (swap the in-process bus for Redis pub/sub or Postgres `LISTEN/NOTIFY` behind the
  same `contactLogEvents` module interface).
- **[Risk]** WS reverse-proxy misconfiguration (nginx/Envoy) silently breaks streaming in
  prod while dev works fine. → **Mitigation**: explicit `/trpc-ws` location block in
  `config/nginx.conf` with `Upgrade`/`Connection` headers; Envoy's existing `/trpc` prefix
  match already covers `/trpc-ws` (verified: Envoy `prefix` matching is a plain string
  prefix, and WS upgrade passthrough needs no special Envoy config for HTTP/1.1 routes).
  Either way, per the goals above, a broken WS never breaks the screens — only the "no manual
  refresh needed" property degrades gracefully back to today's behavior.
- **[Trade-off]** Signal-only subscriptions mean every relevant event costs one refetch
  round-trip client-side, not zero. Accepted: simplicity and shape-consistency (Decision 1)
  outweigh the saved round trip for human-paced operator screens.

## Migration Plan

Additive only — no data migration. Deploy order: apiserver (adds `/trpc-ws`, harmless if
unused) → webapp (starts using it) → infra (`nginx.conf`/`compose` picks up the new location
block on next deploy). If the webapp ships before the proxy config, the client falls back to
polling/refetch-on-navigation automatically (Decision 6) — no user-facing breakage either
order. Rollback is deleting the webapp's subscription hook usage and/or reverting the
apiserver WS mount; neither touches persisted data.

## Open Questions

- None blocking. Pencil is checked during the design/build stage of `/ps:ship`; if it calls
  for a live-update affordance (e.g. a subtle "live" indicator or a flash-highlight on a
  newly-arrived row) that's a webapp-only addition on top of this transport, not a change to
  this design.
