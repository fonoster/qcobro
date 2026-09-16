# Guardrails

The rules an ad must pass before it is created in Meta, even as PAUSED. The sources behind each
rule are in `../research/FORMATS-INVENTORY.md` (§ numbers below refer to that file).
Brand-specific rules (allowed claims, voice, forbidden words) live in the brand layer, e.g.
`../brand/qcobro/BRAND.md`.

## 1. Copy lengths: write to the strictest placement

With Advantage+ placements, one piece of copy is shown everywhere, so write to the tightest limit
and let longer placements show more. The limits are Meta's recommended visible lengths, not hard
caps.

| Field                        | Hard target                                 | Why (tightest placements)                       |
| :--------------------------- | :------------------------------------------ | :---------------------------------------------- |
| Primary text: **first line** | **≤ 40 characters**, and it must work alone | FB Reels 40, IG Reels 44 (§3, §4)               |
| Primary text: total          | ≤ 125 characters                            | Stories, IG Feed, Search, Marketplace, AN (§3)  |
| Headline                     | **≤ 27 characters**                         | FB Feed and Business Explore 27 (§3)            |
| Headline, carousel card      | ≤ 20 characters                             | FB Feed / Messenger Stories carousel (§5)       |
| Description                  | ≤ 18 characters, or omit                    | FB Feed carousel 18 (§5)                        |
| On-image headline            | ≤ 7 words                                   | Legibility at phone size                        |
| Reels overlay headline       | ≤ 10 characters                             | Only if Reels overlay placement is kept on (§3) |

## 2. Policy

| Rule                                                                                                                                                                                            | Source                                  | How to apply                                                                                                                                                                                                                 |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Never assert or imply a personal attribute of the viewer**, including "vulnerable financial status". Questions count too ("Are you in debt?"). "You" is allowed when no attribute is implied. | Meta personal attributes policy (§8)    | Call-outs name a **business role** ("for lending teams"), never a condition of the person.                                                                                                                                   |
| **No private information** (PII, contact, financial, residential, medical) in copy, images, UI screenshots or audio                                                                             | Meta privacy violations policy (§8)     | Anonymize every screenshot and recording: names, amounts, phone numbers, IDs, addresses.                                                                                                                                     |
| **Special ad category** is decided per campaign, by the business owner, and recorded with its reasoning                                                                                         | §8                                      | Financial products & services is _required_ for US audiences (credit also CA and listed EU countries). B2B-only offers are excluded. If you choose "None", keep geo out of those regions and keep every ad unmistakably B2B. |
| **Facts only.** Every number or claim traces to a source the brand owner approved                                                                                                               | Framework rule                          | No invented metrics, no implied guarantees, no before/after financial claims.                                                                                                                                                |
| **No fake UI**                                                                                                                                                                                  | Meta policy (fake buttons are rejected) | See CANVASES "Global rules".                                                                                                                                                                                                 |
| **IG Reels:** no licensed music, no face/camera effects, no GIFs, no product tags                                                                                                               | §4                                      | Use original audio.                                                                                                                                                                                                          |

## 3. AI disclosure

Ask the owner before creating each creative (`self_ai_disclosure` on `ads_create_creative`; it
can't be changed afterwards). Default to **disclose** when the asset contains any of:

- A **photorealistic AI-generated image** (e.g., a generated portrait or scene).
- **Realistic AI-generated audio**, including a synthetic voice agent heard in a call recording.
- A person or event depicted as real that isn't.

Not AI for this purpose: stock photos, real screenshots, real recordings of humans, color
correction, crops.

Meta's published disclosure article covers political and social-issue ads, and Meta also detects
AI media automatically. The rule above is deliberately stricter than the published minimum (§8).

## 4. Advantage+ creative enhancements

Some enhancements are **on by default**, and some can only be switched off in **Advanced
preview** (§7). Review both places for every ad.

| Enhancement                                                       | Default for this framework                                                   | Reason                                              |
| :---------------------------------------------------------------- | :--------------------------------------------------------------------------- | :-------------------------------------------------- |
| Enhance media text (AI rewrites on-image text)                    | **Off**                                                                      | Rewords claims; breaks the facts-only rule          |
| Add overlays (AI)                                                 | **Off**                                                                      | Uncontrolled text position can land in unsafe zones |
| Image generation (AI variations, generated text and logos)        | **Off**                                                                      | Off-brand; invents visuals                          |
| Add animation (AI; animates text)                                 | **Off** for any image with text                                              | Moves text into unsafe zones                        |
| Enhance CTA (can add promo text like "x% off")                    | **Off**                                                                      | Invented offers                                     |
| Artistic filters, varying aspect ratio, feed templates (Page ads) | **Off**                                                                      | Crops through safe zones; off-brand                 |
| Music (incl. AI music)                                            | **Off** when the ad has its own audio; otherwise owner's call                | Would play over a real call                         |
| Video effects (AI contrast/saturation)                            | **Off**                                                                      | Brand color fidelity                                |
| Sticker CTAs                                                      | **Off**                                                                      | Covers content                                      |
| Flexible media                                                    | **Off** for video with text; on for images only if every canvas was supplied | Meta can't detect cropped text in video             |
| Brightness and contrast                                           | Off (low risk; allowed if the owner opts in)                                 | Brand color fidelity                                |
| Carousel: best card first / cards as video                        | Off when card order tells a story; on otherwise                              | Each card should stand alone anyway                 |
| Optimize text per person                                          | On **only** if every text variant is approved                                | Mixes variants freely                               |

## 5. Pre-publish checklist (every ad)

Assets

- [ ] Each export is exactly its canvas size (sips), PNG at 1×.
- [ ] `feed-4x5` **and** `vertical-9x16` exist for the idea (the minimum set).
- [ ] Every export read back: text, logo, faces, UI and offer inside the safe area.
- [ ] Headline readable at 25% zoom.
- [ ] No fake UI; no text on `thumb-1x1-notext` assets.
- [ ] Screenshots and audio fully anonymized.
- [ ] Video: ≤ 15 s, captions burned in, hook in 0–2 s, no licensed music.

Copy

- [ ] Primary text first line ≤ 40 characters and self-sufficient; total ≤ 125.
- [ ] Headline ≤ 27 characters; description ≤ 18 or omitted.
- [ ] Language matches the ad's language; one language per ad.
- [ ] Call-out names a business role; no personal attribute, including as a question.
- [ ] Every number or claim is on the brand's approved list.

Setup

- [ ] Special ad category chosen by the owner, reasoning recorded; geo consistent with it.
- [ ] AI disclosure answered per §3.
- [ ] Advantage+ enhancements set per §4, checked in both the creative panel and Advanced preview.
- [ ] Placement asset customization: 4:5 on feeds, 9:16 on Stories/Reels/Status.
- [ ] `ads_get_ad_preview` reviewed on the PAUSED ad (Meta's overlay geometry isn't published; the preview is the only real check).
- [ ] Everything created PAUSED; going live needs an explicit owner "yes" for that action.

## 6. Keeping this current

Meta changes specs without notice. Re-verify when:

- A review shows an unexplained delivery drop on one placement.
- `ads_get_ad_preview` shows text covered by UI.
- The research file is more than 6 months old.

Update `../research/FORMATS-INVENTORY.md` first (with date and source), then this file and the
`Guide/*` components in `ads.pen`. Never tune a single ad around a spec change.
