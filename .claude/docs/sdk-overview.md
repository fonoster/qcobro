# Checkpoint — sdk/overview

- **Page:** `docs-site/sdk/overview.mdx` (update existing stub)
- **Stage:** 7 (Wire) — page drafted, diagram exported, proofed; at the going-live gate
- **Diátaxis type:** Explanation (orientation page for the SDK section)
- **Docs surface:** Mintlify, `docs-site/` (docs.json). Pencil file: repo-root `pencil.pen`.

## Purpose narrative

A backend/integration developer arrives wanting to drive QCobro from their own
system in TypeScript. This page orients them to `@qcobro/sdk`: what it is (a typed
client over the tRPC apiserver), the one mental model that matters (construct a
`Client` → authenticate → select a workspace → call typed resource namespaces), and
where to go next (install, authenticate, sync accounts, reference).

## Source list (ground truth)

- `mods/sdk/src/index.ts` — public exports: `Client`, `ClientOptions`, `Tokens`, `PortfoliosResource`, `ValidationError`, `FieldError`.
- `mods/sdk/src/client.ts` — Client model: `endpoint`+`/trpc`, `login`/`loginWithApiKey`/`refresh`, `useWorkspace`, `getTokens`/`setTokens`, `trpc` escape hatch, auto-refresh, in-memory tokens.
- `mods/sdk/src/resources/portfolios.ts` — `client.portfolios` methods; client-side Zod validation → `ValidationError`.
- `mods/sdk/src/schemas.ts` — local list/get/listAccounts input schemas.
- `mods/sdk/package.json` — name `@qcobro/sdk` v1.5.4, ESM, deps @trpc/client + zod.
- `docs-site/sdk/sync-accounts.mdx` — voice/component reference (finished sibling page).
- Sibling stubs: installation, authentication, portfolios, errors, reference (titles confirmed).

## Decisions

- Path/slug: `sdk/overview` (unchanged). Nav group: SDK (already wired, first entry).
- Asset: ONE 16:9 component/architecture diagram — "Where the SDK sits" — at `docs-site/images/sdk-overview/`.

## Asset

- `docs-site/images/sdk-overview/architecture.png` (3200×2 = 1600×900 design, 2× PNG, 244K).
  Pencil node `IYv8v` "Doc Asset — SDK Overview Diagram" in repo-root pencil.pen.
  Built from design-system card/logo/label styling; emerald=request, slate=shared API, amber dashed=auth.

## Decision log

- 2026-06-28 Picked sdk/overview (single page) per user; fixed a pre-existing docs.json bug (navigation.pages → navigation.groups) before starting.
- 2026-06-28 Built architecture diagram in Pencil (6 nodes), exported PNG (SVG export unsupported by tooling → documented PNG fallback).
- 2026-06-28 Drafted + proofed page; broken-links clean for this page (1 unrelated pre-existing break in images/ASSETS.md).
