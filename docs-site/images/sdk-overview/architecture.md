# Asset build doc — sdk-overview/architecture

**Artifact:** `architecture.png` (this folder)
**Used on:** `sdk/overview` (SDK overview page)
**Type:** diagram · component / architecture
**Audience:** Customer / SDK consumer — behavior only, no internals (see `docs-site/CLAUDE.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Diagram Kit version:** v1
**Pencil node id:** `H9oQOa` (file: repo-root `pencil.pen`)

> Regenerate from this doc — do not edit the PNG. Change the spec or the kit, then
> re-export node `H9oQOa` (see **Re-export** below).

## One message

`@qcobro/sdk` is a typed client over the QCobro API: your code calls the SDK, the SDK
calls the QCobro API over HTTPS and authenticates — the same hosted API the operator
console uses. (Internals — DB, transport, internal services — are deliberately omitted;
see `docs-site/CLAUDE.md`.)

## Sources (ground truth)

- `mods/sdk/src/client.ts` — the `Client`: `endpoint`, `login` / `loginWithApiKey` /
  `refresh`, `useWorkspace`, in-memory tokens, auto-refresh.
- `mods/sdk/src/resources/portfolios.ts` — `client.portfolios.*` resource methods.
- `mods/sdk/src/index.ts` — public exports (`Client`, `ValidationError`).

## Node / edge spec

Node/edge labels are in Spanish (the docs' authoring language); this spec documents them
in English for editors, matching the convention used in `mcp-overview/overview.md`.

```
Nodes:
  Tu entorno / "TU ENTORNO" (boundary): Tu código (Diagram/Node, "Servicio o app en Node")
  @qcobro/sdk (Diagram/Service, "Cliente TypeScript tipado") — steps:
    1. Autentica: login() o API key
    2. useWorkspace(): acota cada llamada
  QCobro / "QCOBRO" (boundary): QCobro API (Diagram/Node, "La API HTTPS")
  Autenticación (Diagram/External, "Login, API keys y tokens")

Edges:
  Tu código   → @qcobro/sdk    our color    "llama"
  @qcobro/sdk → QCobro API      our color    "HTTPS"
  @qcobro/sdk ⇢ Autenticación   input color  "login / refresh"

Legend:  our = "Petición del SDK" · input = "Credenciales"
Caption (on the page, sdk/overview.mdx): @qcobro/sdk es un cliente tipado sobre la API de
QCobro: la misma API que usa la consola.
```

## Built from (Diagram Kit v1)

Components instanced (in `pencil.pen`, frame `Diagram Kit` = `dkktQ`):

| Component            | id       | Used for                                       |
| :------------------- | :------- | :--------------------------------------------- |
| `Diagram/Node`       | `r2OWa2` | Tu código, QCobro API                          |
| `Diagram/Service`    | `UvobQ`  | the `@qcobro/sdk` node (Q mark + 2 step chips) |
| `Diagram/External`   | `M9EyhC` | the Autenticación card                         |
| `Diagram/Edge Label` | `jHda2`  | every edge label pill                          |
| `Diagram/Step`       | `RApC6`  | the numbered step chips inside Service         |
| `Diagram/Arrow R`    | `X3UJwx` | rightward arrowheads                           |
| `Diagram/Arrow D`    | `wkaMk`  | downward arrowheads                            |

Colors come only from the `dgm-*` tokens. The two boundary frames (`Tu entorno`,
`QCobro`), the connector lines, and the legend are token-bound frames (not components,
since they vary per diagram). The auth edge uses `dgm-edge-input`; the request path uses
`dgm-our`.

## How to change it

- **Minor content** (labels, a node's text): edit the relevant instance in `pencil.pen`
  via the Pencil MCP, then re-export.
- **Structure** (add/remove a node or edge): update the spec above, mirror it in
  `pencil.pen`, re-export.
- **Brand / style** (color, radius, type): do **not** touch this asset — change the
  `dgm-*` token or the kit component once; every diagram updates. Then re-export all.

## Re-export

No `pencil` CLI exists; export is driven through the Pencil MCP:

```
export_nodes(filePath: "pencil.pen", nodeIds: ["H9oQOa"],
             outputDir: "docs-site/images/sdk-overview", format: "png")
```

Then rename the output (`H9oQOa.png`) to `architecture.png`.
