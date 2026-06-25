# Design note — Contact identity (deferred)

**Status:** Deferred. Explicitly **out of scope** for the campaigns-engine v1.
Captured during exploration so it isn't lost; revisit when person-level behavior
or cross-portfolio history is needed.

## Today's model (the constraint)

- `PortfolioAccount` is scoped to one portfolio — `@@unique([portfolioId, externalId])`.
- `phone` and email are free-text, **not unique**, and there is **no person/contact
  entity** that links the same human across portfolios.
- Suppression lives **per row**: `intentStatus` (`INTENT_MET` / `WRONG_NUMBER` /
  `OPT_OUT`) and `suppressUntil` are on `PortfolioAccount`; promise/callback
  suppression and attempt caps are per-campaign on `CampaignAccountState`.

Consequence: the same person in two portfolios is two independent rows. Debt
independence is _good_ (a promise on debt A shouldn't pause debt B), but two
signals leak through the gap.

## Why we'll need a contact concept later

1. **Person-level suppression (compliance).** `OPT_OUT` and `WRONG_NUMBER` are facts
   about the **phone/person**, not the debt. They must follow the human across
   every portfolio and campaign in a workspace. Today they sit on one row, so a
   person who opts out via portfolio A can still be dialed via portfolio B. The
   reserved `DNC_CHECK` trigger ("DNC list management is a future capability")
   anticipates this.
2. **Global contact history.** We will want to see a person's full comms history
   pulled by **phone number and/or email**, across all portfolios and campaigns.
   Today `AccountContactLog` is per `PortfolioAccount`; there is no cross-portfolio
   person view.

Both are the same missing primitive — a contact identity — seen from two angles
(suppression vs. history).

## Sketch of the eventual solution (not committed)

- A **Contact** entity, workspace-scoped, keyed by **normalized identifiers**
  (E.164 phone, lowercased email).
- `PortfolioAccount` resolves/links to a `Contact` on import (match by normalized
  phone/email).
- **Person-level suppression list** keyed by Contact / normalized phone — the
  engine's eligibility funnel checks it first (implements `DNC_CHECK`). Holds
  `OPT_OUT`, `WRONG_NUMBER`, DNC, and is the natural home for a person-level
  **frequency cap** (don't call the same human N× across campaigns).
- **Contact history** = union of `AccountContactLog` across the contact's accounts,
  queryable by phone/email.
- **Prerequisite:** phone normalization to E.164 (and email normalization). The
  field is free-text today.

## Scope split, once a Contact exists

| Scope                             | Signals                                              | Follows               |
| --------------------------------- | ---------------------------------------------------- | --------------------- |
| person / phone (workspace)        | `OPT_OUT`, `WRONG_NUMBER`, DNC, person frequency cap | the human, everywhere |
| debt / row (`PortfolioAccount`)   | `INTENT_MET` (paid/resolved)                         | that debt only        |
| campaign (`CampaignAccountState`) | promise/callback `suppressUntil`, attempt caps       | that campaign only    |

## v1 stance (keep it simple)

The engine ships with **per-row** suppression (`intentStatus`/`suppressUntil` on
`PortfolioAccount`) + **per-campaign** state. `INTENT_MET` stays debt-scoped.
`OPT_OUT`/`WRONG_NUMBER` remain per-row for now — a **documented gap**, not a
silent one. No Contact entity, no phone normalization required for v1. The future
work above is purely additive.
