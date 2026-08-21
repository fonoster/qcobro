## Context

`contactStats` was last touched by `contact-log-axes`, which fixed its _numerator_ — it had been
counting `PortfolioAccount.lastContactedAt IS NOT NULL`, set on every attempt whether or not it
landed, so a portfolio whose every call rang out reported 100%. Moving to `entrega: DELIVERED`
made the numerator honest but left the shape of the statistic untouched: still all-time, still a
count of account rows rather than of activity.

That shape is what fails over time. The numerator is a fact about all history; the denominator is
a snapshot of today. Nothing in the pairing can express "this week we reached fewer people than
last week", which is the only question the card is actually asked.

## Goals / Non-Goals

**Goals:**

- A contact rate that responds to recent performance and can be compared period over period.
- Retry volume must not distort it in either direction.
- An empty window must be visibly empty rather than indistinguishable from total failure.

**Non-Goals:**

- **A page-level period control.** Considered and rejected — see decision 3.
- **Windowing the other four KPIs.** Recovered and promises-kept are flow metrics that arguably
  should be windowed too, but pending balance and accounts-in-management are stock metrics that
  legitimately mean "as of now". Splitting that is its own change.
- **Per-channel breakdown.** One blended rate spans SMS, email, WhatsApp and both voice channels,
  so channel mix will move the number without anything changing. That is the natural next step if
  the number ever looks wrong, not part of this.
- **Send efficiency.** Wasted attempts no longer show in the rate by design; cost-per-contact
  needs its own view.

## Decisions

### 1. Account-level, not attempt-level

The denominator is distinct accounts attempted in the window; the numerator is distinct accounts
delivered to in the window. Each account counts once regardless of how many tries it took.

_Alternative considered:_ attempt-level — delivered gestiones over all gestiones, the literal
"of X sent, Y delivered". Rejected because retries distort it in both directions: a second failed
attempt to an already-unreached account lowers the rate again, and an account reached on its
second attempt scores 50% despite the objective being met. Both are backwards as a health signal,
and the attempt-level number gets _worse_ the harder the engine retries.

_Alternative considered:_ attempt-level normalized by dividing an account's attempts by
`maxAttemptsPerDay`. Rejected — it normalizes against a configuration value rather than reality,
makes campaigns with different caps incomparable, and changes the meaning of stored history
whenever the cap is edited.

The raw gestión count is still surfaced as `totalSends`, so send volume remains visible without
entering the ratio. The gap between it and the denominator _is_ the retry load, which is
information a blended percentage would have hidden.

### 2. Distinct-count via `findMany({ distinct })`, not raw SQL

Prisma's `distinct` with a single-field `select` returns one row per distinct
`portfolioAccountId`, so `.length` is the distinct-account count without dropping to
`$queryRaw`. That keeps the narrow injectable client interface the validated-function pattern
depends on, and keeps the unit tests free of a live database.

The trade-off is that it materializes one row per distinct account rather than counting in the
database. At current scale — thousands of gestiones per workspace per window — that is
immaterial. If a workspace's window ever reaches the tens of thousands of _distinct accounts_,
this should become `COUNT(DISTINCT …)` behind the same interface.

### 3. The period control lives on the card, not the page header

The design originally carried a page-level `Period` control in the dashboard PageHeader. It has
been removed: a header control implies every KPI on the page responds to it, and only one does.
Four of the five cards are stock or all-time metrics whose numbers would not change, which makes
a page-level control an active lie about what the page does.

Putting the control inside the one card whose number it changes keeps the affordance honest, at
the cost of the pattern not generalizing if more cards are windowed later. If that happens, a
page-level control becomes correct — but only once enough cards respond to it.

### 4. The archived filters are dropped

The previous implementation excluded archived accounts and archived portfolios, with a stated
reason: the denominator had to agree with "Cuentas en gestión", which hides archived carteras, or
two KPIs on the same screen would disagree about what is under management.

That constraint applied to a _stock_ denominator. This one counts activity inside a window, and
asks what happened during the period rather than what the book looks like now — so a gestión sent
while an account was active still counts even if the account or portfolio was archived
afterwards. This also matches how `contactLog.list` scopes gestiones: by workspace, not by current
archived state.

### 5. `—`, never `0%`, on an empty window

Emptiness is detected from `totalSends === 0` rather than from the denominator, so "we sent
nothing" and "we sent things and reached nobody" stay distinguishable. A zero denominator
rendering as `0%` is the most common way a rate like this misleads.

## Risks / Trade-offs

- **A short window is a small sample.** At 24h the denominator can be a handful of accounts, and
  a single failure swings the percentage hard. → The card always shows the raw counts beside the
  percentage, so `3 de 4` reads as a small sample rather than a crisis. 24h is kept because it is
  the one window that catches a provider outage the same day.

- **The number will read low for about a month.** EMAIL and WHATSAPP gestiones predating
  delivery-signal ingestion are permanently `DISPATCHED` and count as attempted-but-not-reached.
  → Self-clearing; the 7d default clears within a week of shipping. Worth a release-note line so
  the recovery is not mistaken for a fix.

- **Channel mix moves the rate.** A month with proportionally more SMS reads worse even if every
  channel held steady. → Accepted for now; a per-channel breakdown is the escalation path.

- **Weekday composition.** Collections activity has a weekly shape, so a window that is not a
  whole number of weeks mixes weekday compositions as it slides and manufactures drift. → Why the
  options are 7/14/28 rather than 7/15/30, and why the default is 7.
