# Asset build doc — mcp-overview/overview

**Artifact:** `overview.png` (this folder)
**Used on:** `mcp/overview` (MCP server page)
**Type:** diagram (component / architecture)
**Audience:** Customer / MCP integrator — behavior only, no internals (see `docs-site/CLAUDE.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Diagram Kit version:** v1
**Pencil node id:** `knSrg` (file: repo-root `pencil.pen`)

> Regenerate from this doc — do not edit the PNG. Change the spec or the kit, then
> re-export node `knSrg` (see **Re-export** below).

## One message

`@qcobro/mcp` wraps `@qcobro/sdk` so an MCP client — Claude Desktop, or any other MCP
host — can manage QCobro directly: the client calls the server's tools, the server
validates the workspace API key and delegates every call to the SDK, which reaches the
same HTTPS API the console uses.

## Sources (ground truth)

- `mods/mcp/src/env.ts` — required env vars (`QCOBRO_ACCESS_KEY_ID`,
  `QCOBRO_ACCESS_KEY_SECRET`, `QCOBRO_WORKSPACE`), default endpoint.
- `mods/mcp/src/config/writeClaudeConfig.ts` — the `qcobro` Claude Desktop config entry.
- `mods/mcp/README.md` — setup, tools list, troubleshooting (mirrored in the docs page).
- `docs-site/mcp/overview.mdx` — the page this asset illustrates.

## Node / edge spec

```
Nodes:
  TU ANFITRIÓN MCP (boundary): Claude Desktop (Diagram/External, icon "sparkles",
    one-off amber accent #D97706 / #FDF1E3 for brand recall — not a dgm-* token)
  @qcobro/mcp (Diagram/Service) — steps: Valida credenciales → Delega en @qcobro/sdk
  QCOBRO (boundary): QCobro API (Diagram/Node, icon "server")
  Autenticación (Diagram/External) — API key de workspace

Edges:
  Claude Desktop → @qcobro/mcp    our color    "llamadas MCP"
  @qcobro/mcp    → QCobro API     our color    "HTTPS"
  @qcobro/mcp    ⇢ Autenticación  input color  "API key de workspace"

Legend:  our = camino de la petición · input = credenciales
Caption: @qcobro/mcp envuelve @qcobro/sdk para que un cliente MCP como Claude Desktop
         gestione QCobro directamente.
```

Layout deliberately mirrors `sdk-overview/architecture` (same grid, same connector
geometry) so the two pages read as one system — only the client-side node changed.

## Built from (Diagram Kit v1)

| Component            | id       | Used for                                  |
| :------------------- | :------- | :---------------------------------------- |
| `Diagram/External`   | `M9EyhC` | Claude Desktop, Autenticación             |
| `Diagram/Service`    | `UvobQ`  | the `@qcobro/mcp` node (Q mark + 2 steps) |
| `Diagram/Node`       | `r2OWa2` | QCobro API                                |
| `Diagram/Edge Label` | `jHda2`  | every edge label pill                     |
| `Diagram/Step`       | `RApC6`  | the numbered step chips inside Service    |
| `Diagram/Arrow R`    | `X3UJwx` | rightward arrowheads                      |
| `Diagram/Arrow D`    | `wkaMk`  | downward arrowhead                        |

Colors come from `dgm-*` tokens, with one deliberate exception: the Claude Desktop
node's icon (`#D97706` on `#FDF1E3`) is hardcoded, not token-bound. It exists purely so
the client node is instantly recognizable as Claude — it is not part of the kit's
semantic `our`/`input` color grammar and should not be reused for other external nodes.
(Note: referencing document variables with a dot in their name, e.g. `$ds.amber`, did
not resolve in this file — it silently rendered black. Use the resolved hex instead, or
a hyphenated `dgm-*` token.)

## How to change it

- **Minor content** (labels, a node's text): edit the relevant instance in `pencil.pen`
  via the Pencil MCP, then re-export.
- **Structure** (add/remove a node or edge): update the spec above, mirror it in
  `pencil.pen`, re-export.
- **Brand / style** (color, radius, type): do **not** touch this asset for kit-token
  colors — change the `dgm-*` token once; every diagram updates, then re-export all.
  The Claude accent is the one color that must be changed here directly if ever revised.

## Re-export

Driven through the Pencil MCP:

```
export_nodes(filePath: "pencil.pen", nodeIds: ["knSrg"],
             outputDir: "docs-site/images/mcp-overview", format: "png")
```

Then rename the output (`knSrg.png`) to `overview.png`.
