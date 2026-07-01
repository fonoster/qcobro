## Context

`PortfolioDetail.tsx` already has a "Ver detalle" row action opening a `Dialog` with a
curated `<dl>` of 4 fields (balance, DPD, phone, email) — added incrementally, not
designed as a complete account-detail view. `PortfolioAccountRecord`
(`mods/common/src/types/portfolios.ts`) carries ~15 more fields never surfaced in the
console. This is an operator utility view (inspecting a record when the summary isn't
enough), not a polished customer-facing screen.

Note: `email` is accepted by `AccountRowInput`/`CreatePortfolioInput`
(`mods/common/src/schemas/portfolios.ts`) but is not on `PortfolioAccountRecord` itself
— the existing dialog reads `viewDetail.email` off the raw row data, which may be
`undefined` for rows created without a CSV `email` column. Not addressed here (pre-
existing behavior); noted for awareness only.

## Goals / Non-Goals

**Goals:**

- Let an operator see every field on an account record from the console, without
  changing the curated basic view.
- Reuse existing primitives (`Dialog`, `Accordion`) — no new design-system components.

**Non-Goals:**

- Redesigning the basic-fields summary or its layout.
- Editing capability for the extra fields (read-only view only).
- A polished/branded presentation for the JSON section — this is a diagnostic view.

## Decisions

- **No new Pencil screen/frame.** This composes two already-designed primitives
  (`Dialog`, `Accordion`) inside an existing dialog; it doesn't introduce new visual
  language. Following the `console-refinements` precedent (low-hanging-fruit UI changes
  that reuse existing components skip a dedicated Pencil pass). If the plain
  `<pre>`-rendered JSON reads as too raw once built, that's a one-line follow-up, not a
  redesign.
- **"Rest of the record" = full record minus the 4 basic fields**, computed by omitting
  `outstandingBalance`, `daysPastDue`, `phone`, `email` from the row object rather than
  hand-maintaining a field allowlist — so any field added to `PortfolioAccountRecord`
  later shows up automatically instead of silently being hidden.
- **JSON tree = `Accordion` item + `<pre>{JSON.stringify(rest, null, 2)}</pre>`.** There's
  a direct precedent for raw `JSON.stringify` display in `CampaignDetail.tsx` (trigger
  config); no need for a dedicated tree-view widget/dependency for one diagnostic panel.
- **Collapsed by default**, matching the "Ver metadata" framing — the common case (4 basic
  fields) stays uncluttered.

## Risks / Trade-offs

- [Risk] A raw JSON dump is not translated/i18n'd (field names stay in English/camelCase).
  → Acceptable: this is an operator diagnostic view of the raw record, not user-facing
  copy: no i18n requirement for internal field names, only for the "Ver metadata" label
  itself.
- [Risk] Dates/numbers render in raw JS form (e.g. ISO timestamps) rather than the
  locale-formatted style used elsewhere. → Acceptable for a diagnostic view; formatting
  the whole record would defeat the "no hand-maintained field list" decision above.
