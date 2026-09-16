# QCobro Meta Ads — Direction

Decided with Pedro on 2026-09-16. This brief is the input to the ads framework
(`design/ads/framework/`) and to every `/ps:ads` run for QCobro. Change it here, not in a
campaign.

## What an ad is for

An ad has one job: get a **microfinance lender, or a company with a small collections team, in
the Dominican Republic** to ask for the **free pilot** (15 days, 300 accounts, a recovery
report at the end).

| Decision            | Choice                                                   | Why                                                                                                                                                              |
| :------------------ | :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destination         | The pilot landing page on the site                       | The ad matches the page it opens, and the Pixel can count pilot requests, so we can tell whether the page convinced someone. Not a Meta lead form, not WhatsApp. |
| Audience            | Broad: all of the DR, no interest or job-title narrowing | Meta's job and interest data for the DR is thin, and narrowing drives up the cost. The creative picks out its own audience.                                      |
| Self-selection      | The first line of text and the image call out lenders    | Lenders stop and consumers scroll past. Every template reserves a place for this call-out.                                                                       |
| Special ad category | None (B2B software)                                      | QCobro sells software to lenders and offers no credit to the viewer. The guardrails list the wording that could make Meta's review classify it as financial.     |
| Language            | Spanish (templates stay i18n-ready)                      | DR first.                                                                                                                                                        |

## Who it speaks to, and who it never speaks to

- **Speaks to:** the owner or manager of a lending portfolio. They are the reader.
- **Never speaks to debtors.** No "¿Debes dinero?", no "you", no copy that could read as an ad
  aimed at someone in debt. The debtor is only ever the lender's client, in the third person.

## Look

**Revised 2026-09-16 after the first drafts.** The editorial v3 look and the gestión-record widget
don't stop a thumb in a feed, and most viewers have never heard of QCobro. Ads are louder than
the site:

- **Say what QCobro is first.** Every ad opens with the category: "Cobranzas automatizadas con Voz
  IA" (or a channel variant). The pilot offer comes later in the funnel, never as the lead.
- **People doing collection work**, in realistic Dominican photos, with the text on a dark scrim
  that never covers faces. No readable third-party brands, dates or religious imagery.
- **Money icons** as the visual hook.
- **Big, bold type** (heavy sans, all caps) when there is no photo, on high-contrast fills
  (near-black, strong green) with a lime highlight.
- The QCobro wordmark stays small, inside the safe area. One idea per ad.

The v3 editorial look stays on the website; the first drafts in that style remain in `ads.pen`
sections 04–05 for reference.

## Proof the ads may use

| Allowed                       | Notes                                                                                                      |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------- |
| Pilot terms and public prices | Facts only: free, 15 days, 300 accounts, recovery report, prices as published.                             |
| Real console screens          | The gestión filling in (Entrega → Camino → Resultado) and the 6 channels. Anonymized data only.            |
| Real anonymized calls         | Audio or captioned video of a real Voz IA call, with names, amounts and phone numbers removed or replaced. |

**Not allowed on ads:** testimonials (not chosen for ads), invented metrics or recovery-rate
numbers, the Mikro quote, Credifácil by name, GitHub or community stats.

## Round 1 formats

The framework documents every format. The first campaign ships **static images only**
(4:5 feed + 9:16 story/reel per idea); updated 2026-09-16, see `brand/qcobro/rounds/r1.md`.
The captioned call Reel moves to a later round.

## Surfaces the framework covers

Facebook, Instagram, Messenger, WhatsApp and Audience Network. **Threads is out of scope.**
