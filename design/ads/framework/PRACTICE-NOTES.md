# Practice notes: running the framework for real

A log of what worked and what didn't when the framework met a real campaign (QCobro round 1,
started 2026-09-16 with `/ps:ads new`). This is the evidence for the psstack port: each gap lists
what to change and where.

## Gaps found

| #   | Where it showed up               | Gap                                                                                                                                                                                                  | Proposed fix (for the port)                                                                                                                   |
| :-- | :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/ps:ads new` order              | The wizard asks objective → audience → money → creative. Direction ("what kind of ads") has to come first, because it decides format, production cost and even whether a video budget makes sense.   | Add **Batch 0 · Direction** (voice, angles, image carrier, qualifier, AI imagery), and write the result to a round brief before any settings. |
| 2   | Setup                            | Setup doesn't check that the Pixel, the Page, the Instagram account and the payment method all belong to the **same** ad account. Here the Pixel was in a business account with no card and no Page. | Add an "account readiness" table to setup: Pixel owner, Page linked, IG linked, payment method, events fired. Block `Create`, not direction.  |
| 3   | Setup                            | The advertiser Page can differ from the product brand (Fonoster Page, QCobro product). The skill assumes they match.                                                                                 | Ask which Page speaks. If it differs, add the product and company to the primary text ("QCobro, de Fonoster").                                |
| 4   | Destination                      | Nothing checks that the landing page offers what the ad promises. The live site offered "demo gratis"; the ads promise the pilot.                                                                    | Add a **message-match check**: fetch the landing page, confirm the offer and the conversion event exist, then decide launch timing.           |
| 5   | `naming.md`                      | No `offer` angle key, though an offer-led ad is a standard B2B angle.                                                                                                                                | Add `offer` to the angle library and naming grammar.                                                                                          |
| 6   | `placements.md` vs `CANVASES.md` | Preset names differ (`feed45`/`story916` at 1080 vs `feed-4x5`/`vertical-9x16` at 1440).                                                                                                             | Replace `placements.md` with the framework canvases; keep one name set.                                                                       |
| 7   | Pencil                           | `execute` silently targets the active editor when the `filePath` isn't open; a separate `.pen` must be opened in Pen.app first. Pen.app doesn't flush to disk until saved.                           | Document in the `creative` step: open the file, verify with `get_app_state`, check mtime before committing.                                   |
| 8   | Pencil export                    | Exporting in the same `execute` call that built the frame captured half-rendered frames.                                                                                                             | Already in `CANVASES.md` → Export step 0; carry into the skill.                                                                               |

## What worked

- One-question-at-a-time direction produced decisions in minutes and surfaced a user correction
  (static only) that a batched form would have buried.
- The templates' named slots made new ads a copy + fill job: the pain ad went from template to
  filled frames in one call.
- Guardrail copy limits turned drafting into a check: all three ads passed first time.
