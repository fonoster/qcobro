# Asset build doc — channels/fanout

**Artifact:** `fanout.png` (this folder)
**Used on:** `concepts/channels`
**Type:** diagram · hub-and-spoke
**Audience:** Customer — behavior only, no internals (see `docs-site/AGENTS.md`)
**Preset:** 16:9 `1600 × 900` (exported at 2× → `3200 × 1800`)
**Diagram Kit version:** v1
**Node id:** `mqLe9` (file: `designs/docs.pen`)

> Regenerate from this doc — do not edit the PNG. Change the spec or the kit, then
> re-export node `mqLe9`.

## One message

A single QCobro reaches a customer through whichever **channel** the chosen agent uses — the
hub fans out to Voz IA, Voz pregrabada, SMS, Correo, and WhatsApp.

## Node / edge spec

```
Left: a QCobro hub card (radio-tower icon, emerald accent) —
      "Un agente por canal, en el idioma de la cuenta."
A glowing hub node fans out with our-color connectors to five channel cards (right):

  phone-call     · Voz IA          · Llamada conversacional con IA
  phone          · Voz pregrabada  · Llamada con un guion grabado
  message-square · SMS             · Mensaje de texto
  mail           · Correo          · Email
  message-circle · WhatsApp        · Mensaje de WhatsApp

Caption: "Cada contacto queda registrado como una gestión, con su resultado y análisis con IA."
```

## Built from (Diagram Kit v1)

Bespoke cards (icon medallion + title + subtitle) on a `layout:"none"` canvas; the fan-out
connectors are token-bound rotated rectangles from a hub dot to each card's left edge (same
technique as `home/hero`). Fully token-bound to `dgm-*`, so a rebrand propagates.

## Re-export

Open `designs/docs.pen` in Nib, then:

```
get_screenshot(id: "mqLe9", scale: 2)
```

and save the PNG as `docs-site/images/channels/fanout.png`.
