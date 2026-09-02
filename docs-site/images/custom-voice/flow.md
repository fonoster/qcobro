# Asset build doc — custom-voice/flow

**Artifact:** `flow.png` (this folder)
**Used on:** `guides/custom-voice`
**Type:** diagram · flow / pipeline
**Audience:** Customer — behavior only, no internals (see `docs-site/CLAUDE.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Diagram Kit version:** v1
**Pencil node id:** `HqFVE` (file: repo-root `pencil.pen`)

> Regenerate from this doc — do not edit the PNG. Change the spec or the kit, then
> re-export node `HqFVE`.

## One message

Getting a custom voice into QCobro is a four-stage journey: you record and clone it with
ElevenLabs, QCobro enables it for your workspace, and it's ready to use in an agent.

## Node / edge spec

```
Layout: 2x2 grid, boustrophedon reading order (row 1 left→right, wrap down-left, row 2 left→right)
Nodes:  Graba tu voz(node, mic)              ElevenLabs(external, audio-lines)
        QCobro(service, brand mark)          Úsala en un agente(node, bot)
Edges:  Graba tu voz → ElevenLabs ("CLONA") — row 1, horizontal
        ElevenLabs → QCobro ("ID DE VOZ") — orthogonal wrap: down from ElevenLabs'
          bottom-center, left across the row gap, down into QCobro's top-center
        QCobro → Úsala en un agente ("DISPONIBLE") — row 2, horizontal
Legend: none (encoding is self-evident: green border + brand mark = QCobro,
        gray icon chip = external provider, plain card = your own action)
```

## Built from (Diagram Kit v1)

Instances of `Diagram/Node` (r2OWa2) for the two customer-side steps, `Diagram/External`
(M9EyhC) for ElevenLabs, `Diagram/Edge Label` (jHda2) for the three edge pills,
`Diagram/Arrow R` (X3UJwx) for the two in-row arrowheads, and `Diagram/Arrow D` (wkaMk) for
the wrap connector's final downward entry into QCobro. The QCobro node is a literal frame
copying `Diagram/Service`'s (UvobQ) header styling (brand mark + title/subtitle, `dgm-our` /
`dgm-our-deep` / `dgm-our-soft`) without its `SvcSteps` chip list, since a component
instance's descendants can't be deleted — only overridden — and the steps list didn't fit
a 4-node top-level flow. Connectors are thin `dgm-our`-filled rectangles routed between
measured card edges. Fully token-bound to `dgm-*`, so a rebrand propagates.

**v2 — moved off a single tight row.** The original v1 packed all four cards into one
1600×600 row (300px cards, 48px gaps) and read as cramped. Rearranged into a 2×2 grid at
the 16:9 1600×900 preset instead: cards widened to 620px, titles at 18px (top of the kit's
documented 14–18 range), icons enlarged (20→24px on `Diagram/Node`, 21→24px icon +
42→48px icon box on `Diagram/External`, 36→40px brand mark on QCobro), subtitle nudged
12→13px. The row-to-row connection is a 3-segment orthogonal wrap (stub down · across ·
stub down into the node) rather than a straight line, since the two rows aren't
horizontally aligned to the same connector line — routed only through the empty band
between rows, never crossing a card.

**Failure mode hit while rebuilding, worth flagging for next time:** overriding a
`Diagram/Node` / `Diagram/External` instance's size/font descendants (`width`, `height`,
`fontSize`) without _also_ re-specifying its `content`/`icon` in the same `descendants`
object silently resets that field to the kit's placeholder default ("Title", `file-text`
icon) instead of preserving the prior override. Content and styling overrides need to be
set together in one `descendants` payload, not layered across separate calls.

**Frame built by copying an existing working diagram frame** (`mqLe9`, channels/fanout)
and clearing its children, then overriding `height` to 600 — per the project's Pencil
build workaround (a brand-new top-level frame renders blank). Child node `x`/`y` are
relative to the frame's own origin, not absolute canvas coordinates — using absolute
coordinates on a fresh insert is what actually caused the early blank renders in this
asset's case, not the height override (isolated by testing both independently).

## Re-export

```
Export(["HqFVE"], "png", "docs-site/images/custom-voice")
```

Then rename the output (`HqFVE.png`) to `flow.png`.
