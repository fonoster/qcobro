# Canvases

Every ad is designed on one of these canvases. They live in `design/ads/ads.pen`, section
**02 · Static templates** (frames `tpl/<canvas>`) and **03 · Sequences**. Numbers come from
Meta's Ads Guide as of 2026-09-16 (`../research/FORMATS-INVENTORY.md`). Where Meta gives no
number, the rule is marked **heuristic**.

## Global rules

- **Design at 1440 px wide, export at 1×.** Meta's recommended sizes moved from 1080 to 1440 in 2026. A 1440 asset also satisfies every 1080 minimum.
- **Safe zones are hard rules.** Text, logos, faces, product UI and the offer stay out of the red
  bands. Background imagery may bleed into them.
- **One 9:16 asset can deliver to every vertical placement**, so the vertical guide uses the
  strictest combination of Meta's numbers, not the most generous one.
- **Headline ≥ 80 px** at 1440 wide (≈ 60 px at 1080). Call-out ≥ 36 px.
- **One idea per frame.** The headline carries the angle; the proof shows it.
- **No fake UI:** no fake play buttons, notifications, close buttons or CTA buttons in the image.
  The platform draws the real CTA.

## Static canvases

| Canvas             | Size      | Covers                                                                                                   | Unsafe bands (px at canvas size)                                                                                                                                      | Content box `x, y, w, h`                    | Headline size |
| :----------------- | :-------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ | :------------ |
| `vertical-9x16`    | 1440×2560 | FB/IG Stories, FB/IG Reels, Messenger Stories, WhatsApp Status, IG Feed and Explore home video, AN video | top **358** (14%), bottom **896** (35%), sides **86** (6%). With a disclaimer: bottom **1024** (40%)                                                                  | 86, 358, 1268, 1306                         | 124           |
| `feed-4x5`         | 1440×1800 | FB Feed, IG Feed, IG Explore home, FB video feeds, lead-ad image                                         | 86 on every edge (**heuristic**: Meta says keep the bottom and side edges clear but gives no numbers). Critical content between y **180–1620** so a 1:1 crop survives | 86, 180, 1268, 1440                         | 116           |
| `square-1x1`       | 1440×1440 | Marketplace, Search, Business Explore, Messenger inbox, AN native, carousel cards                        | 86 on every edge (**heuristic**)                                                                                                                                      | 86, 86, 1268, 1268                          | 104           |
| `landscape-191`    | 1440×754  | FB Search, Business Explore, collection cover, IG profile feed video                                     | 45 top/bottom, 86 sides (**heuristic**)                                                                                                                               | 86, 45, 1268, 664 (text left, proof right)  | 76            |
| `widescreen-16x9`  | 1920×1080 | FB in-stream video                                                                                       | 65 top, **216 bottom** (player controls), 115 sides (**heuristic**)                                                                                                   | 115, 65, 1690, 799 (text left, proof right) | 96            |
| `thumb-1x1-notext` | 1440×1440 | FB right column, Ads on FB Reels (overlay), in-stream image                                              | **No on-image text at all** (Meta advice: renders small)                                                                                                              | subject only                                | —             |

### Slots (every text canvas)

Slots are named layers inside `content`, top to bottom:

| Slot              | Purpose                                | Rule                                                                  |
| :---------------- | :------------------------------------- | :-------------------------------------------------------------------- |
| `slot/callout`    | Self-selection line: who the ad is for | Names a business role, never a personal attribute (see GUARDRAILS §2) |
| `slot/headline`   | The one idea                           | ≤ 7 words, display face                                               |
| `slot/sub`        | Optional supporting fact               | One line; delete it when space is tight                               |
| `slot/proof`      | What makes the claim believable        | Product UI, a real call, or offer facts; fills the remaining height   |
| `slot/wordmark`   | Brand mark                             | Small, inside the content box, never the hero                         |
| `bg/image`        | Full-bleed background                  | May bleed into unsafe bands                                           |
| `safe-zone-guide` | Instance of `Guide/<canvas>`           | Visible while designing, `enabled:false` for export                   |

## Sequences

| Sequence        | Card size | Where                                                         | Rules                                                                                                                                                           |
| :-------------- | :-------- | :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carousel-1x1`  | 1440×1440 | FB Feed, Marketplace, Search, Business Explore, Messenger, AN | 2–10 cards. Each card must stand alone: Meta may reorder cards, show only card 1 (right column), or turn the set into a slideshow. Card 1 carries the call-out. |
| `carousel-4x5`  | 1440×1800 | IG Feed                                                       | Images only. One video card forces the whole carousel to 1:1.                                                                                                   |
| `carousel-9x16` | 1440×2560 | IG Stories, FB Reels (image tiles)                            | IG Stories auto-plays 1–3 cards, then "Expand"; video cards ≤ 15 s. FB Stories carousel: no video, 3–10 cards.                                                  |

## Video

Canvas: `video-9x16` storyboard (section 03), same geometry as `vertical-9x16` with a caption
band. For a feed cut, reuse the `feed-4x5` geometry.

| Rule         | Value                                                                                                           | Why                                                                                                         |
| :----------- | :-------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| Length       | **≤ 15 s**                                                                                                      | FB/Messenger Stories split longer videos into cards; in-stream cuts at 15 s; in-stream Reels ads are 5–15 s |
| Hook         | First 0–2 s                                                                                                     | Most placements autoplay muted in a scrolling feed                                                          |
| Beats        | 0–2 s hook · 2–12 s proof · 12–15 s offer                                                                       | Storyboard frames in section 03                                                                             |
| Captions     | **Burned in**, ≤ 2 lines, inside the content box, above the 35% line (`slot/captions`, y 1450–1640)             | Muted autoplay; Audience Network doesn't support caption files                                              |
| Encoding     | MP4, H.264, square pixels, fixed frame rate, progressive, AAC stereo ≥ 128 kbps, no edit lists or special boxes | Ads Guide, every video placement                                                                            |
| Music        | No licensed music on IG Reels; original or Meta Sound Collection audio only                                     | IG Reels ad rule                                                                                            |
| Effects      | No face or camera effects, no GIFs, no product tags on IG Reels                                                 | IG Reels ad rule                                                                                            |
| Primary text | Write for **40** characters visible (FB Reels)                                                                  | Reels truncate hardest                                                                                      |

## Export

0. **Export in a separate `execute` call from the one that built or edited the frame.** Exporting
   in the same call can capture a half-rendered frame: missing component instances, or faded
   text.
1. In each frame to export, set `safe-zone-guide` → `enabled:false`.
2. `Export([frameIds], "png", "<abs dir>", {scale: 1})`. **`scale: 1` is mandatory**; the default is 2×.
3. Files land as `<nodeId>.png`. Rename to `<ad_name>__<canvas>.png`.
4. Verify with `sips -g pixelWidth -g pixelHeight`: it must match the canvas size exactly.
5. Re-enable the guides.
6. Read every exported PNG and run the checklist in `GUARDRAILS.md` §5.
