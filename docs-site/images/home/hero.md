# Asset build doc — home/hero

**Artifact:** `hero.png` (this folder)
**Used on:** `index` (docs home page)
**Type:** illustration · brand hero (artistic / technical)
**Audience:** Customer — behavior/brand only, no internals (see `docs-site/CLAUDE.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Pencil node id:** `r0KBNV` (file: repo-root `pencil.pen`)

> Regenerate from this doc — do not edit the PNG. Change the scene in `pencil.pen`, then
> re-export node `r0KBNV` (see **Re-export** below).

## One message

A welcoming, premium brand hero with a technical feel: on a dark emerald canvas, the QCobro
brand lockup and tagline ("Cobranza multilingüe con voz por IA.") sit beside a glowing **voice
waveform** that resolves through a hub into the three outreach **channels** — Voz IA, SMS,
Correo. It says, at a glance: QCobro is multilingual AI-voice collections across channels.

## Scene spec

```
Background: dark emerald → ink linear gradient + two soft radial glows + a faint dot grid.
Left: Q mark medallion (emerald gradient, glow) + "QCobro / by Fonoster" wordmark,
      tagline "Cobranza multilingüe con voz por IA.", and pills "Voz IA · SMS · Correo".
Right: a 34-bar voice waveform (emerald gradient bars) → a glowing hub node → three
       glass channel cards (phone-call · Voz IA, message-square · SMS, mail · Correo),
       linked by thin emerald connectors.
```

Colors are drawn from the brand greens (`#34D399` `#10B981` `#047857` `#6EE7B7`,
ink `#04130C`/`#091324`). This asset is **bespoke** (not Diagram Kit), but stays on-brand;
keep it in sync with the palette if the brand changes.

## Notes / gotchas

- The exporter (`export_nodes`) choked on a `mesh_gradient` background; the frame fill is a
  **linear gradient** instead. Avoid `mesh_gradient` here if you want reliable re-export.

## Re-export

Driven through the Pencil MCP:

```
export_nodes(filePath: "pencil.pen", nodeIds: ["r0KBNV"],
             outputDir: "docs-site/images/home", format: "png")
```

Then rename the output (`r0KBNV.png`) to `hero.png`.
