## Why

Every money value in the operator console is formatted for the wrong locale. Five pages each
carry their own private `money()` helper, and each one hardcodes the generic Spanish tag
`"es"` (or, on the Panel de control, the _UI language_ — `"es"` or `"en"`) instead of the
workspace's actual locale, `es-DO`.

The two locales disagree on the separator that matters most:

| formatter                       | 32000 DOP renders as |
| ------------------------------- | -------------------- |
| `Intl.NumberFormat("es", …)`    | `32.000 DOP`         |
| `Intl.NumberFormat("es-DO", …)` | `RD$32,000`          |

So a Dominican operator reads `RD$32.000` as thirty-two _point_ zero — the period is the
decimal separator in es-DO — and the currency shows as the bare code `DOP` rather than the
`RD$` symbol. English hides the bug by coincidence (`"en"` groups with commas too) while
still showing the wrong symbol.

The workspace locale is already persisted, already validated, and already exposed to the
console through `useWorkspaceLocale()` — but exactly one call site uses it
(`ReachOutModal`, so the send preview matches the text the agent will actually read aloud).
Everywhere else drifted. Issue #94.

## What Changes

- **One shared money formatter for the console**, resolving both the workspace **currency**
  and the workspace **locale** from workspace settings. The five per-page `money()` helpers
  are deleted in favour of it.
- **Cents render only when the amount has them** — `RD$32,000` for a round balance,
  `RD$32,000.50` when there are cents. This aligns the console with `formatMoney()` in
  `@qcobro/common`, which formats the amounts an agent speaks in outreach copy: an operator
  previewing a balance and the debtor hearing it now see the same number. It is a change for
  the Panel de control, whose KPIs currently round cents away.
- **The web-console spec gains locale** alongside currency in its money-formatting
  requirement, so "formatted in the chosen currency" can no longer be satisfied by a
  hardcoded locale.

Out of scope: date/time formatting. Dates deliberately follow the console's **UI language**
(`Intl.DateTimeFormat(language, …)`), which is what the `web-console` spec already requires
of the portfolio "last synced" column — a Dominican operator reading the console in English
should get English month names.

## Capabilities

### Modified Capabilities

- `web-console`: Money rendered anywhere in the console SHALL be formatted with the active
  workspace's **locale** as well as its currency, and SHALL show fractional units only when
  the amount has them.

## Impact

- **`mods/webapp`**: `src/lib/useWorkspaceCurrency.ts` gains the shared formatter hook; the
  private `money()` / `currency()` helpers in `Home.tsx`, `Portfolios.tsx`,
  `PortfolioDetail.tsx`, `PaymentPromises.tsx` and `GestionDetail.tsx` are removed and their
  call sites switched to it.
- **No API, schema, or database change.** `locale` is already persisted on
  `WorkspaceSettings` and already served by `workspaceSettings.get`.
- **Visible behavior change**: amounts across the console re-render as `RD$32,000` instead of
  `32.000 DOP`; Panel de control KPIs stop rounding cents away.
- **`USD` workspaces** are affected too — `Intl.NumberFormat("es-DO", { currency: "USD" })`
  renders `US$32,000`, which is the correct Dominican rendering of a US-dollar amount.
