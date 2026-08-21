## Why

The Panel de control's "Tasa de contacto" is an all-time ratio with mismatched time bases: an
all-time numerator (accounts ever reached) over a right-now denominator (accounts currently in
non-archived portfolios). Three consequences, all of which get worse the longer a workspace runs:

- **It is a ratchet.** Once an account is reached it counts as reached permanently, so the number
  only climbs toward 100% and then sits there — measuring import history, not contact performance.
- **Archiving moves it.** Archiving a portfolio changes the ratio without anyone contacting anyone.
- **It is mislabeled.** "Tasa de contacto" reads as a rate; what is implemented is coverage.

## What Changes

- **`contactStats` becomes windowed and account-level.** Within a selected period, the
  denominator is distinct accounts with at least one gestión, and the numerator is distinct
  accounts with at least one `DELIVERED` gestión. It also returns the raw gestión count in the
  window, which the card shows as "envíos".
- **A period control on the contact-rate card only** — 24h / 7d / 14d / 28d, defaulting to 7d.
  Deliberately in-card rather than page-level: a header control would imply the whole Panel de
  control responds to it, which it does not.
- **An explicit empty state.** A window with no gestiones renders `—` and "sin envíos en el
  período", never `0%`.
- The archived-account and archived-portfolio filters are dropped from this statistic, because
  they existed to keep a _stock_ count in step with "Cuentas en gestión" and this is no longer a
  stock count.

**Not** attempt-level ("of X sent, Y delivered"). That reintroduces a worse distortion: a retry to
someone who did not receive the first message lowers the rate, and _succeeding_ on the second
attempt still scores 50%. Both are backwards — reaching the account is the objective. With
`maxAttemptsPerDay` at 1, a 7-day window caps an account at ~7 attempts, and if 10% of numbers are
dead and absorb all 7 while good numbers take 1–2, attempt-level reads 66% where account-level
reads 90% — 24 points of difference manufactured purely by retry volume, and it worsens the harder
the engine tries.

A `maxAttemptsPerDay` divisor was considered and rejected: it normalizes against a configuration
value rather than reality, makes campaigns with different caps incomparable, and silently changes
the meaning of historical numbers whenever someone edits the cap.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `portfolios`: the workspace contact statistic gains a required period and changes from an
  all-time account-coverage count to a windowed, account-level rate over gestiones.
- `web-console`: the Panel de control's contact-rate KPI gains a period control, a counts
  subline, and an explicit no-sends state.

## Impact

**Code**

- `mods/common/src/schemas/portfolios.ts` — period enum + `contactStats` input schema
- `mods/apiserver/src/functions/portfolios/contactStats.ts` (+ test) — rewritten as a validated
  function counting distinct `portfolioAccountId` over `accountContactLog.contactedAt`
- `mods/apiserver/src/trpc/routers/portfolios.ts` — the procedure takes the period
- `mods/webapp/src/components/kpi-card.tsx` — optional `period` prop; cards that do not pass it
  render exactly as before
- `mods/webapp/src/pages/Home.tsx`, `mods/webapp/src/lib/i18n.tsx`, KPI stories

**No schema change and no migration.** Two grouped reads plus a count, all over existing columns.

**Expect a low reading until roughly late September.** EMAIL and WHATSAPP gestiones sent before
delivery-signal ingestion went live are permanently `DISPATCHED` and count as not reached. The 7d
window clears within a week of this shipping.

**Not affected** — the other four KPI cards, which keep their current all-time/snapshot semantics.
