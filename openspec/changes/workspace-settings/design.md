## Context

Workspaces are owned by Fonoster Identity; in the apiserver a workspace is just a
`workspaceRef` string (the access key id) attached to rows. There is no app-side workspace
record today. Two settings are mis-homed:

- **Currency** lives on `Portfolio.currency` (`Currency` enum USD/DOP), set at portfolio
  create and used by the CSV sync, the `{{currency}}` dispatch variable, and money display.
- **Timezone** lives in `qcobro.json → apiserver.timezone` and is injected into the tRPC
  context as `ctx.timezone`, consumed by `reserveAttempt` (daily-cap reset) and the campaign
  outreach-window logic. The campaigns spec explicitly defers per-workspace timezones.

We want both to be per-workspace **without touching Identity**.

## Goals / Non-Goals

**Goals:**

- Add an app-owned `WorkspaceSettings` store keyed by `workspaceRef` (currency, timezone).
- Make currency a workspace setting; remove it from `Portfolio` and the sync.
- Make timezone a workspace setting; the engine reads it per workspace.
- Keep `qcobro.json` timezone as the default used to seed a new workspace's setting.

**Non-Goals:**

- No Identity changes (no workspace entity, membership, or auth changes).
- No currency conversion / FX — a workspace has exactly one display currency.
- No new currencies beyond the existing `USD`/`DOP` enum.
- No historical re-statement of past gestiones/amounts in a new currency.

## Decisions

### D1. `WorkspaceSettings` keyed by `workspaceRef`, in the app DB

`model WorkspaceSettings { workspaceRef String @id, currency Currency @default(USD),
timezone String, createdAt, updatedAt }`. `@id` on `workspaceRef` gives one row per
workspace and a natural upsert key. The app owns app-settings; Identity owns identity. This
is the entire mechanism that makes per-workspace config possible without Identity.

_Alternatives:_ (a) deployment-wide `qcobro.json` currency — rejected, not per-workspace;
(b) derive currency from portfolios — rejected, ambiguous and not settable.

### D2. Resolve settings in the tRPC context (with seed-on-read defaults)

The context already computes `ctx.timezone`. It will instead resolve the active workspace's
`WorkspaceSettings` (upserting a default row when absent: currency `USD`, timezone = the
`qcobro.json` default) and expose `ctx.timezone` + `ctx.currency` from it. This keeps every
procedure and the engine reading a single resolved value; only the source changes. Seed-on-
read means no workspace is ever missing settings and the `qcobro.json` default stays
meaningful for fresh workspaces.

### D3. Currency removal is breaking; migrate by backfill then drop

The Prisma migration: create `workspace_settings`; **backfill** one row per distinct
`workspaceRef` found across portfolios, choosing that workspace's currency if all its
portfolios agree, else `USD`, and timezone = the configured default; then **drop**
`Portfolio.currency`. Remove `currency` from the portfolio create input and `syncAccounts`
(currency was never a per-account field, so the CSV itself is unaffected — only the create
form/SDK arg and the model column go away).

### D4. `{{currency}}` and money formatting read the workspace currency

The dispatch context builder currently pulls `currency` from the owning portfolio; it will
take the resolved workspace currency instead. The webapp formats money from the workspace
currency (fetched once via the settings query) rather than a hardcoded `USD` or a per-cartera
value.

### D5. Settings UI on the existing "Configuración del espacio" page

Add Currency (select USD/DOP) + Timezone (IANA string/select) fields, backed by a
`workspaceSettings.get`/`update` tRPC router. No new page or nav entry.

## Risks / Trade-offs

- **Dropping `Portfolio.currency` is destructive** → Mitigation: backfill workspace currency
  from existing portfolios before dropping; greenfield/dev data makes this low-risk, and the
  enum/value space is unchanged.
- **Mixed-currency workspaces lose per-cartera currency** → Accepted: a workspace is now
  single-currency by design; if a deployment truly needs multiple currencies it uses multiple
  workspaces.
- **Timezone source change could shift campaign windows** → Mitigation: seed each workspace's
  timezone from the current `qcobro.json` value so behavior is unchanged until an operator
  edits it.
- **Context now does a settings lookup per request** → Mitigation: a single indexed
  primary-key read (cacheable later); negligible vs. existing per-request work.

## Migration Plan

1. Add `WorkspaceSettings` model + `workspaceSettings` router; resolve in context with
   seed-on-read; keep `Portfolio.currency` temporarily.
2. Switch dispatch `{{currency}}` and webapp formatting to the workspace currency.
3. Backfill `workspace_settings` from portfolios; drop `Portfolio.currency` and remove it
   from the create input + sync + forms.
4. Ship the settings UI.

Rollback: steps 1–2 are additive; defer the destructive drop (step 3) until verified.

## Open Questions

- Timezone field UX: a curated IANA dropdown vs. free text? (Default: a short curated list
  covering the served markets, free-text fallback.)
