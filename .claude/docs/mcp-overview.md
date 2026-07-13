# Checkpoint — mcp/overview

- **Page:** `docs-site/mcp/overview.mdx` (update existing page — editorial review + banner)
- **Stage:** 7 (Wire) — page already wired into `docs.json` under "MCP"; banner added, proofing
- **Diátaxis type:** Explanation (orientation page for `@qcobro/mcp`, sibling of `sdk/overview`)
- **Docs surface:** Mintlify, `docs-site/` (docs.json). Pencil file: repo-root `pencil.pen`.

## Purpose narrative

A developer who wants an AI assistant (Claude Desktop, or any MCP host) to manage QCobro
directly arrives at this page to learn what `@qcobro/mcp` is, how to configure it, and
what tools it exposes. After reading, they can install the server, authenticate it with a
workspace API key, and drive portfolios through their assistant.

## Source list (ground truth)

- `mods/mcp/src/env.ts` — required env vars, default endpoint.
- `mods/mcp/src/config/writeClaudeConfig.ts` — the `qcobro` Claude Desktop config entry shape.
- `mods/mcp/src/tools/*` — the 7 portfolios tools (matches the page's table).
- `mods/mcp/README.md` — setup/tools/troubleshooting narrative (page mirrors it accurately).
- `docs-site/CLAUDE.md` — editorial policy (scope, voice, realistic example data).

## Decisions

- Page content was accurate against source; no rewrite needed.
- One real editorial fix: the page invented an `AP`-prefixed example ID that (at the time)
  had no documented format. Investigated further — `AP` **is** the real API-key
  `accessKeyId` prefix (confirmed by the user), distinct from the `WO` workspace prefix.
  Net result: page's original ID was correct and is unchanged; instead fixed
  `docs-site/CLAUDE.md` (which only documented `WO`) and two _other_ pages that had
  wrongly reused the `WO` workspace ID for an API-key `accessKeyId`:
  `sdk/authentication.mdx` and `api/authentication.mdx`.
- Banner: architecture diagram (Diagram Kit), not a bespoke illustration — matches
  `sdk/overview`'s treatment. Layout intentionally mirrors `sdk-overview/architecture`
  (same grid/connector geometry) so the two pages read as one system.
- Claude Desktop node: user asked for the actual Claude logo; no official asset was
  available in-session and freehand-reproducing a trademarked logomark was judged too
  risky. Used a generic `sparkles` icon with a one-off amber accent (`#D97706`/`#FDF1E3`,
  not a `dgm-*` token) for brand recall instead — user confirmed this approach.

## Asset

- `docs-site/images/mcp-overview/overview.png` (3200×1800 = 1600×900 design, 2× PNG, ~243K).
  Pencil node `knSrg` "Diagram · MCP Overview (kit)" in repo-root `pencil.pen`.
  Nodes: Claude Desktop (External) → @qcobro/mcp (Service) → QCobro API (Node), plus
  Autenticación (External). Registered in `images/ASSETS.md`; build doc at
  `docs-site/images/mcp-overview/overview.md`.

## Decision log

- 2026-07-13 — Reviewed page against `docs-site/CLAUDE.md`; content accurate against
  `mods/mcp` source. Flagged `AP`-prefixed ID as a possible invented format.
- 2026-07-13 — User confirmed banner = architecture diagram (not bespoke illustration),
  and Claude Desktop node = generic icon + amber accent (not a reproduced logo).
- 2026-07-13 — Built diagram in Pencil (`pencil.pen`, active editor had to be switched
  from a different open project first). `$ds.amber` variable reference (dotted name)
  silently resolved to black; used the resolved hex directly instead — documented as a
  gotcha in the asset's build doc.
- 2026-07-13 — Exported asset, wrote build doc, added ledger row, wired `<Frame>` into
  the page.
- 2026-07-13 — User corrected the `AP`/`WO` ID call: `AP` is the real API-key prefix.
  Reverted the mcp/overview.mdx change, then fixed the actual bug it surfaced —
  `sdk/authentication.mdx` and `api/authentication.mdx` both reused the `WO` workspace ID
  for an API-key `accessKeyId` — and documented the `AP` format in
  `docs-site/CLAUDE.md`'s realistic-example-data table.
- 2026-07-13 — Ran `npx mintlify broken-links` to proof; pending result.
