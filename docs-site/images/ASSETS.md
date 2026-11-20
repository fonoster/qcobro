# Docs assets ledger

Every committed docs asset, its source-of-truth build doc, and the design node it
exports from. This is the index for **consistency** (everything is built from the same
Diagram Kit) and **scale** (a rebrand walks this table and re-exports each node).

The rendered images are **artifacts** — never hand-edit them. Edit the build doc / kit,
then re-export the node id.

## What Mintlify will actually serve

Only some file types are published as downloadable assets on our plan: images, `.mp4` /
`.webm`, `.mp3` / `.wav`, `.json`, `.yaml`, `.css`, `.js`, and fonts. **`.csv`, `.pdf`,
`.txt`, `.xml` and `.zip` are Enterprise-only** — committing one and linking to it builds
fine and then 404s with `Asset not found` in production, with nothing failing in between.

So don't ship a downloadable sample file. Inline the sample in the page (a code block, in an
`<Accordion>` if it's long) so readers copy it out instead of downloading it. An
`ejemplo-cuentas.csv` under `docs-site/files/` was removed for exactly this reason.

## Diagram Kit

Shared, token-bound components live in `designs/docs.pen`, frame **`Diagram Kit`** (`dkktQ`).
All diagram color comes from `dgm-*` variables — change a token to re-skin every asset.

**Current version:** v1

| Token group          | Variables                                             |
| :------------------- | :---------------------------------------------------- |
| Ink / text           | `dgm-ink` `dgm-muted`                                 |
| Surfaces             | `dgm-surface` `dgm-canvas` `dgm-border`               |
| Our service / action | `dgm-our` `dgm-our-deep` `dgm-our-soft` `dgm-our-ink` |
| Inputs / icons       | `dgm-edge-input` `dgm-icon` `dgm-icon-box`            |
| Geometry             | `dgm-radius-node` `dgm-radius-inner` `dgm-pill`       |

| Component            | id       |
| :------------------- | :------- |
| `Diagram/Node`       | `r2OWa2` |
| `Diagram/Service`    | `UvobQ`  |
| `Diagram/External`   | `M9EyhC` |
| `Diagram/Edge Label` | `jHda2`  |
| `Diagram/Step`       | `RApC6`  |
| `Diagram/Arrow R`    | `X3UJwx` |
| `Diagram/Arrow D`    | `wkaMk`  |

## Assets

All assets are **hosted-product, customer-facing** — no internals, infra, or config files
(see `../AGENTS.md`).

| Slug                           | Type                   | Audience            | Preset   | Page                        | Node     | Kit | Build doc                      |
| :----------------------------- | :--------------------- | :------------------ | :------- | :-------------------------- | :------- | :-- | :----------------------------- |
| `sdk-overview/architecture`    | diagram (architecture) | customer / SDK      | 1600×900 | `sdk/overview`              | `H9oQOa` | v1  | `sdk-overview/architecture.md` |
| `mcp-overview/overview`        | diagram (architecture) | customer / MCP      | 1600×900 | `mcp/overview`              | `knSrg`  | v1  | `mcp-overview/overview.md`     |
| `how-qcobro-works/flow`        | diagram (flow)         | customer            | 1600×900 | `concepts/how-qcobro-works` | `fjsng`  | v1  | `how-qcobro-works/flow.md`     |
| `campaigns-engine/flow`        | diagram (flow)         | customer            | 1600×900 | `concepts/campaigns-engine` | `bDSCq`  | v1  | `campaigns-engine/flow.md`     |
| `channels/fanout`              | diagram (hub-spoke)    | customer            | 1600×900 | `concepts/channels`         | `mqLe9`  | v1  | `channels/fanout.md`           |
| `home/hero`                    | illustration (brand)   | customer            | 1600×900 | `index`                     | `r0KBNV` | —   | `home/hero.md`                 |
| `guides/portfolios/list`       | screenshot (console)   | customer / operator | 1440×900 | `guides/portfolios`         | console  | —   | —                              |
| `guides/import-accounts/modal` | screenshot (console)   | customer / operator | modal    | `guides/import-accounts`    | console  | —   | —                              |
| `custom-voice/flow`            | diagram (flow)         | customer / operator | 1600×900 | `guides/custom-voice`       | `HqFVE`  | v1  | `custom-voice/flow.md`         |
| `guides/agent-templates/list`  | screenshot (console)   | customer / operator | 1440×900 | `guides/agent-templates`    | console  | —   | —                              |
| `guides/campaigns/list`        | screenshot (console)   | customer / operator | 1440×900 | `guides/campaigns`          | console  | —   | —                              |
| `guides/payment-promises/list` | screenshot (console)   | customer / operator | 1440×900 | `guides/payment-promises`   | console  | —   | —                              |
| `guides/ai-insights/detail`    | screenshot (console)   | customer / operator | panel    | `guides/ai-insights`        | console  | —   | —                              |

Screenshots (Node `console`) are captured from the running console, not exported from a design
file (the designs show columns the console doesn't have). In the dev container, sign in to the
seeded demo workspace (`demo@qcobro.com`, Créditos Demo) in light mode, dismiss the early-access
notice, and capture with Playwright at `deviceScaleFactor: 2`: list pages at a 1440×900 viewport;
`import-accounts/modal` as the Importar cuentas dialog element over the cartera, with a CSV
selected; `ai-insights/detail` as the side panel opened from Gestiones on the Voz IA gestión with
a payment promise (1440×2000 viewport so the panel shows whole). Save each as its slug.

## Rebrand at scale

1. Change a `dgm-*` token once in `designs/qcobro.lib.pen`, or a kit component in
   `designs/docs.pen`.
2. Every instance in every diagram picks it up.
3. Re-export each asset's node id (column above) with Nib's `get_screenshot` at `scale: 2`, and
   save it as its slug. (No standalone CLI — this is an agent/MCP step.)
