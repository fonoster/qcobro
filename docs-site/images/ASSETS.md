# Docs assets ledger

Every committed docs asset, its source-of-truth build doc, and the Pencil node it
exports from. This is the index for **consistency** (everything is built from the same
Diagram Kit) and **scale** (a rebrand walks this table and re-exports each node).

The rendered images are **artifacts** — never hand-edit them. Edit the build doc / kit,
then re-export the node id.

## Diagram Kit

Shared, token-bound components live in `pencil.pen`, frame **`Diagram Kit`** (`dkktQ`).
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
(see `../CLAUDE.md`).

| Slug                        | Type                   | Audience       | Preset   | Page                        | Pencil node | Kit | Build doc                      |
| :-------------------------- | :--------------------- | :------------- | :------- | :-------------------------- | :---------- | :-- | :----------------------------- |
| `sdk-overview/architecture` | diagram (architecture) | customer / SDK | 1600×900 | `sdk/overview`              | `H9oQOa`    | v1  | `sdk-overview/architecture.md` |
| `how-qcobro-works/flow`     | diagram (flow)         | customer       | 1600×900 | `concepts/how-qcobro-works` | `fjsng`     | v1  | `how-qcobro-works/flow.md`     |

## Rebrand at scale

1. Change a `dgm-*` token (or a kit component) once in `pencil.pen`.
2. Pencil propagates to every instance in every diagram.
3. Re-export each asset's node id (column above) via the Pencil MCP `export_nodes`, and
   rename to its slug. (No standalone CLI — this is an agent/MCP step.)
