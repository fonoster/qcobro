## 1. Contracts

- [x] 1.1 Add the period enum (`24h` / `7d` / `14d` / `28d`) and the `contactStats` input schema
      to `mods/common/src/schemas/portfolios.ts`, defaulting to `7d`
- [x] 1.2 Export the period type so the webapp can drive its select options from the schema
      rather than a duplicated literal list

## 2. Statistic

- [x] 2.1 Rewrite `contactStats` as a validated function: distinct `portfolioAccountId` over
      `accountContactLog` filtered on `contactedAt`, for both the attempted and delivered counts
- [x] 2.2 Return the raw gestión count in the window as `totalSends`, outside the ratio
- [x] 2.3 Drop the archived-account/archived-portfolio filters, and record in the doc-comment why
      they no longer apply now that the denominator is activity rather than stock
- [x] 2.4 Wire the period input through the `portfolios.contactStats` tRPC procedure

## 3. Console

- [x] 3.1 Add an optional `period` prop to `KpiCard` rendering the pill (calendar icon, select,
      chevron) right-aligned beside the label; cards that omit it render exactly as before
- [x] 3.2 Render the contact-rate card through `KpiCard` in `Home.tsx`, holding the selected
      period in local state and re-querying on change
- [x] 3.3 Show the counts subline, and the no-sends state (`—` plus a message) when the window
      has no gestiones
- [x] 3.4 Add all new copy to **both** language maps in `i18n.tsx`, keeping the subline short
      enough not to clip inside the card
- [x] 3.5 Match the subline colour to the sibling KPI cards Home renders inline

## 4. Tests

- [x] 4.1 Retrying an unreached account does not lower the rate
- [x] 4.2 An account reached on a later attempt counts as reached, once
- [x] 4.3 An empty window returns zeros rather than dividing by zero
- [x] 4.4 The window boundary moves with the selected period
- [x] 4.5 The period defaults to 7 days
- [x] 4.6 Gestiones from another workspace are excluded
- [x] 4.7 The 24h window is exercised, and delivery _outside_ the window does not count an account
      as reached when its only in-window attempts failed
- [x] 4.8 An unrecognized period is rejected with a structured validation error
- [x] 4.9 Story coverage for the card's period control and its no-sends state
- [x] 4.10 `npm run build`, `npx eslint .` and the apiserver suite all clean

## 5. Deferred

- [ ] 5.1 Wire up `KpiCard`'s existing unused `trend` prop — the Pencil design specified
      `+4 pts vs. semana` and the prop was built, but nothing computes a previous-period delta.
      Natural follow-up now that the metric is windowed
- [ ] 5.2 Decide whether the fifth "Saldo pendiente" card belongs; the design has four cards and
      the code renders five into a four-column grid, leaving one orphaned on a second row
- [ ] 5.3 Revisit whether the other flow metrics (recovered, promises kept) should share a window,
      at which point a page-level period control becomes the right pattern
