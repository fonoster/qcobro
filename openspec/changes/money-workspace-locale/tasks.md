## 1. Shared formatter

- [x] 1.1 Add `useMoney()` to `mods/webapp/src/lib/useWorkspaceCurrency.ts`: reads workspace
      currency + locale (reusing `useWorkspaceCurrency()` / `useWorkspaceLocale()`) and
      returns a stable `(value: number) => string` formatter
- [x] 1.2 Format with `style: "currency"`, the workspace currency, and fraction digits
      derived from the value — `0` when `Number.isInteger(value)`, else `2` (min and max),
      mirroring `formatMoney()` in `@qcobro/common/utils/money`
- [x] 1.3 Memoize the `Intl.NumberFormat` on `[locale, currency]` so it is not rebuilt per row

## 2. Replace the per-page helpers

- [x] 2.1 `Home.tsx` — delete the local `money()` (it formats with the UI `language`), use
      `useMoney()`; KPI values now show cents when present
- [x] 2.2 `Portfolios.tsx` — delete the local `money(v, currency)`, use `useMoney()`
- [x] 2.3 `PortfolioDetail.tsx` — delete the local `money(v, currency)`, use `useMoney()`
- [x] 2.4 `PaymentPromises.tsx` — delete the local `money(v, currency)`, use `useMoney()`
- [x] 2.5 `GestionDetail.tsx` — delete the local `currency(n, code)`, use `useMoney()`
- [x] 2.6 Drop now-unused `useWorkspaceCurrency` imports from those pages — **except
      `PortfolioDetail.tsx`**, which keeps `useWorkspaceCurrency()` alongside the new
      `useMoney()`: it still passes the raw currency code to `ReachOutModal` via
      `portfolio={{ currency: wsCurrency }}` for the send preview
- [x] 2.7 Confirm no `Intl.NumberFormat` with a hardcoded or language-derived locale remains
      for money anywhere under `mods/webapp/src` (date formatting stays on the UI language)

## 3. Tests + verification

- [x] 3.1 Unit-test the fraction-digit rule and locale/currency resolution (round amount →
      no decimals; fractional amount → two; `es-DO` + `DOP` → `RD$32,000`; loading/unset
      settings → `DEFAULT_LOCALE`)
- [x] 3.2 `npm run typecheck --workspace @qcobro/webapp` and `npm run lint` clean
      (lerna resolves to the main checkout from a worktree — use `--workspace`)
- [ ] 3.3 Verify in the running console that dashboard, portfolios, portfolio detail,
      promises, and gestión detail all render `RD$32,000`-style amounts — **NOT verified**;
      left unchecked per instructions not to spin up the dev stack
