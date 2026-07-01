## Why

The "Ver detalle" action on a portfolio's accounts table opens a dialog showing only 4
fields (balance, days past due, phone, email). The underlying `PortfolioAccountRecord`
carries many more fields (principal, terms, missed installments, last payment,
negotiation options, customer segment, best time to call, etc.) that an operator
currently has no way to see in the console — they'd have to query the database
directly. Operators need to be able to inspect the full record when the curated
summary isn't enough, without cluttering the primary dialog view for the common case.

## What Changes

- The existing account detail dialog (`PortfolioDetail.tsx`) gains a "Ver metadata" expander
  below the current basic fields.
- Expanding it reveals the rest of the account record — every field not already shown
  in the basic summary — rendered as a JSON tree.
- The basic fields (balance, DPD, phone, email) and the dialog's trigger action are
  unchanged.

## Capabilities

### Modified Capabilities

- `web-console`: the portfolio account detail dialog gains a "Ver metadata" expandable
  section showing the full account record as a JSON tree.

## Impact

- **`mods/webapp`**: `PortfolioDetail.tsx` (the `viewDetail` `Dialog`) gains an
  `Accordion` section with a JSON dump of the remaining `PortfolioAccountRecord`
  fields. No new components beyond composing the existing `Dialog` and `Accordion`
  primitives.
- No backend or schema changes — `portfolios.listAccounts` already returns the full
  record; this only changes what the console renders.
