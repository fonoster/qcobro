# Asset build doc — campaigns-engine/flow

**Artifact:** `flow.png` (this folder)
**Used on:** `concepts/campaigns-engine`
**Type:** diagram · flow / pipeline
**Audience:** Customer — behavior only, no internals (see `docs-site/CLAUDE.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Diagram Kit version:** v1
**Pencil node id:** `bDSCq` (file: repo-root `pencil.pen`)

> Regenerate from this doc — do not edit the PNG. Change the spec or the kit, then
> re-export node `bDSCq`.

## One message

How QCobro decides whom to contact and when: an **active campaign** runs within its **rules**
(days, hours, date range, attempt caps), makes a **contact** inside those rules and the
workspace timezone, and records each attempt as a **gestión** — counted once. (Engine
machinery is deliberately omitted; behavior only.)

## Node / edge spec

```
A left-to-right pipeline of four large step cards, joined by our-color arrows:

  Campaña activa → Reglas → Contacto → Gestión

  megaphone        · Campaña activa · Programada sobre tus carteras
  sliders-horizontal · Reglas       · Días, horario, fechas y topes de intentos
  phone-outgoing   · Contacto       · Dentro de las reglas, en la zona horaria del espacio
  clipboard-check  · Gestión        · Cada intento, una sola vez, con su resultado

Caption: "También puedes contactar manualmente una cuenta o registrar gestiones por la API."
```

## Built from (Diagram Kit v1)

Bespoke large step cards (icon medallion + title + wrapping subtitle), same style as
`how-qcobro-works/flow`; `Diagram/Arrow R` (`X3UJwx`) for the arrowheads. Fully token-bound to
`dgm-*`, so a rebrand propagates. See `how-qcobro-works/flow.md` for the shared card recipe.

## Re-export

```
export_nodes(filePath: "pencil.pen", nodeIds: ["bDSCq"],
             outputDir: "docs-site/images/campaigns-engine", format: "png")
```

Then rename the output (`bDSCq.png`) to `flow.png`.
