# Meta Ads Framework

A brand-agnostic system for designing Meta ads that survive every placement: Facebook,
Instagram, Messenger, WhatsApp and Audience Network. Built for QCobro first; meant to move into
psstack (`/ps:ads`) once proven.

## What's here

| Path                               | What it is                                                                                                    | Brand-specific?            |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------- |
| `../research/FORMATS-INVENTORY.md` | Every placement × format spec, dated and sourced to Meta's Ads Guide and Help Center; contradictions listed   | No                         |
| `CANVASES.md`                      | The 6 static canvases, 3 carousel sets and the video storyboard: sizes, safe-zone pixels, slots, export steps | No                         |
| `GUARDRAILS.md`                    | Copy lengths, policy, AI disclosure, Advantage+ enhancement defaults, pre-publish checklist                   | No                         |
| `../ads.pen` sections 00–03        | Read-me, `Guide/*` safe-zone components, `tpl/*` templates, carousel and video sequences                      | No (only `brand-*` tokens) |
| `../ads.pen` section 04            | Brand components and example ads                                                                              | **Yes**                    |
| `../brand/<brand>/BRAND.md`        | Tokens, components, voice, approved claims, campaign defaults                                                 | **Yes**                    |
| `../DIRECTION.md`                  | Why the brand's ads look and target the way they do                                                           | **Yes**                    |

## Workflow for one ad idea

1. **Direction exists:** the brand has a `DIRECTION.md` and `BRAND.md`. If not, write them first.
2. **Pick the canvases:** always `feed-4x5` + `vertical-9x16` (the minimum set); add others only
   for a specific placement or a carousel.
3. **Copy the templates** in `ads.pen` → rename `<ad_name>__<canvas>` → fill the slots with brand
   components and approved claims. Keep `safe-zone-guide` visible while designing.
4. **Write the copy** to GUARDRAILS §1 lengths and the brand's voice.
5. **Export** per CANVASES "Export" (separate call, guides hidden, scale 1, rename, sips).
6. **Check** every export against GUARDRAILS §5.
7. **Create PAUSED** in Meta with placement asset customization (4:5 feeds, 9:16 vertical). Set the
   enhancements (GUARDRAILS §4), answer AI disclosure (§3), review `ads_get_ad_preview`.
8. **Go live** only on an explicit owner "yes" for that action.

## Adding a brand

1. Copy `ads.pen` sections 00–03 (or the whole file) and set the `brand-*` variables.
2. Build the brand's proof components in section 04 (product UI, logo, photography rules).
3. Write `brand/<brand>/BRAND.md` from the QCobro one as a model.

## Moving into psstack

The portable parts are the research inventory, `CANVASES.md`, `GUARDRAILS.md` and `ads.pen`
sections 00–03. They would replace `/ps:ads` `references/placements.md` and feed its `creative`
step. The per-brand parts stay in each brand's repo. Differences from the current skill:

| `/ps:ads` today                 | This framework                                                                                                           |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| 4 presets at 1080               | 6 canvases + 3 carousel sets + video storyboard at 1440                                                                  |
| One approximate 9:16 band       | Strictest union of Meta's published numbers (14/35/6, 40 with disclaimer) as reusable components                         |
| Frames and guides drawn per run | Templates with named slots, copied per ad                                                                                |
| Field limits only               | Per-placement visible-length targets, Advantage+ switch defaults, AI disclosure rule, policy findings, publish checklist |
