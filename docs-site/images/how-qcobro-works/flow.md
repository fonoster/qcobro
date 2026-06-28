# Asset build doc — how-qcobro-works/flow

**Artifact:** `flow.png` (this folder)
**Used on:** `concepts/how-qcobro-works` (orientation page)
**Type:** diagram · flow / pipeline
**Audience:** Customer — behavior only, no internals (see `docs-site/CLAUDE.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Diagram Kit version:** v1
**Pencil node id:** `fjsng` (file: repo-root `pencil.pen`)

> Regenerate from this doc — do not edit the PNG. Change the spec or the kit, then
> re-export node `fjsng` (see **Re-export** below).

## One message

QCobro lleva una cuenta de deuda desde su cartera hasta una promesa de pago: organizas las
cuentas en carteras, defines agentes, contactas (por campaña o manualmente) a través de los
canales (voz, SMS, correo) y cada intento queda como una gestión con análisis por IA, que puede
originar una promesa de pago. (Sin internos — DB, servicios internos, motor — deliberadamente
omitidos; ver `docs-site/CLAUDE.md`.)

## Node / edge spec

```
A left-to-right pipeline of five large step cards, joined by our-color arrows:

  Carteras y cuentas  →  Agentes  →  Contacto  →  Canales  →  Resultado

Each card (256 wide, centered): a 88×88 our-soft icon medallion (40px our-deep lucide icon),
a bold 22px ink title, and a muted 14px wrapping subtitle.

  folder-open      · Carteras y cuentas · Tus cuentas de deuda, agrupadas por cliente
  bot              · Agentes            · Definen qué decir y por qué canal
  megaphone        · Contacto           · Una campaña agendada o de forma manual
  radio            · Canales            · Voz, SMS y correo, en su idioma
  clipboard-check  · Resultado          · Cada gestión, su análisis con IA y la promesa de pago

Each connector: a short our-color line + Arrow R.
Caption (our tick + muted text): "Multilingüe por diseño · la consola de operador y el SDK
trabajan sobre la misma API."
```

## Built from (Diagram Kit v1)

Components instanced (in `pencil.pen`, frame `Diagram Kit` = `dkktQ`):

| Component         | id       | Used for                 |
| :---------------- | :------- | :----------------------- |
| `Diagram/Arrow R` | `X3UJwx` | the rightward arrowheads |

The five step cards are **bespoke** large cards (icon medallion + title + wrapping subtitle),
not `Diagram/Node` instances, because this asset wants more visual weight than the compact kit
node. They are still fully token-bound: the medallion uses `dgm-our-soft`/`dgm-our-deep`, the
card uses `dgm-surface`/`dgm-border`/`dgm-radius-node`, and text uses `dgm-ink`/`dgm-muted`. The
frame, title block, connector lines and caption are token-bound too. A rebrand via the `dgm-*`
tokens still propagates here.

## How to change it

- **Minor content** (labels, a card's text): edit the relevant instance in `pencil.pen` via
  the Pencil MCP, then re-export.
- **Structure** (add/remove a step): update the spec above, mirror it in `pencil.pen`,
  re-export.
- **Brand / style** (color, radius, type): do **not** touch this asset — change the `dgm-*`
  token or the kit component once; every diagram updates. Then re-export all.

## Re-export

No `pencil` CLI exists; export is driven through the Pencil MCP:

```
export_nodes(filePath: "pencil.pen", nodeIds: ["fjsng"],
             outputDir: "docs-site/images/how-qcobro-works", format: "png")
```

Then rename the output (`fjsng.png`) to `flow.png`.
