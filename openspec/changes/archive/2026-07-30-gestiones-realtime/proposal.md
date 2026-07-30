## Why

The Gestiones list and Gestión detail view are QCobro's highest-churn operator screens: the
campaigns engine originates outreach continuously, and enrichment (delivery status, Voz IA
transcript/recording, AI analysis, inbound email/WhatsApp replies, payment-promise updates)
lands asynchronously well after the initial gestión is written. Today both screens only
reflect that activity after a manual refresh, which makes the console feel stale during an
active campaign and forces operators to poll by reloading. Issue #60 asks for realtime
streaming targeted at exactly these two screens.

## What Changes

- **New WebSocket streaming transport on apiserver** — a tRPC subscription adapter
  (`@trpc/server/adapters/ws`) mounted on the existing HTTP server at a dedicated `/trpc-ws`
  path, alongside the current `/trpc` HTTP batch endpoint. Greenfield: apiserver has no
  streaming transport today.
- **A single change-event bus** (`accountContactLog` + `paymentPromise` writes) fed by a
  Prisma Client Extension in `mods/apiserver/src/db.ts`, so every existing write path (manual
  create, engine dispatch, voice/email/WhatsApp webhook ingestion, AI insight generation,
  payment-promise resolution) is covered without instrumenting each call site individually.
  Emitted signals carry only `{ id, workspaceRef }` — never the row itself.
- **New subscription procedure** `campaigns.contactLog.onChange` (workspace-scoped,
  optionally narrowed to one gestión id) that streams those signals to subscribed clients.
- **Webapp: realtime-augmented Gestiones list and Gestión detail.** Both screens keep their
  existing tRPC queries (`campaigns.contactLog.list` / `.get`) as the source of truth; a new
  subscription hook listens for change signals and invalidates/refetches the relevant query
  in place. The existing refetch/query path is the explicit fallback when the stream is
  unavailable (offline, WS blocked, etc.) — nothing regresses when streaming can't connect.
- **Pencil design check** for both screens before any UI work, per this repo's design-first
  convention — covered as a design-stage task, not resolved by this proposal.
- Supporting infra: `mods/webapp/vite.config.ts` dev proxy, `config/nginx.conf` websocket
  upgrade routing, and explicit `ws`/`@types/ws` dependencies on `mods/apiserver` (today only
  present transitively through a webapp devDependency).

## Capabilities

### New Capabilities

- `realtime-streaming`: the WebSocket-based tRPC subscription transport itself — connection
  lifecycle, workspace-scoped auth over WS, the change-event bus, and the
  `campaigns.contactLog.onChange` subscription procedure. Reusable by later screens, but this
  change only wires it for Gestiones/Gestión detail.

### Modified Capabilities

- `account-contact-log`: the Gestión list and Gestión detail requirements gain a realtime
  behavior clause — both views reflect gestión/payment-promise changes live via the streaming
  transport, falling back to the existing refetch-on-demand behavior when a stream isn't
  available. No change to what data a gestión carries or how it's created.

## Impact

- **apiserver**: `src/db.ts` (Prisma extension), new `src/services/contactLogEvents.ts`, new
  WS mount in `src/index.ts`, new context-building path for WS connections in
  `src/trpc/context.ts`, new subscription procedure in `src/trpc/routers/campaigns.ts`,
  `package.json` (add `ws`, `@types/ws`).
- **webapp**: `src/lib/trpc.ts` (split link: ws for subscriptions, http batch for
  everything else), new subscription hook, `src/pages/Gestiones.tsx` and
  `src/pages/GestionDetail.tsx` wired to it, `vite.config.ts` dev proxy.
- **infra**: `config/nginx.conf` (new `/trpc-ws` location with upgrade headers); `config/envoy.yaml`
  already prefix-matches `/trpc*` to the apiserver cluster, so no change needed there.
- **Pencil** (`pencil.pen`): checked for the two screens; updated only if the design calls
  for a live-update affordance (e.g. connection-status indicator).
- No database schema change and no change to existing REST/tRPC query/mutation contracts —
  additive only.
