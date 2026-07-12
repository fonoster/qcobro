# Workspace Billing — Design

## Context

QCobro dispatches outreach across five channels (SMS, email, WhatsApp, pre-recorded voice, AI voice), each costing real provider money (Twilio, Resend, Meta, Fonoster/ElevenLabs). There is no metering, no plans, and no payment. Two adjacent systems shape this design:

- The **engine flight recorder** (`engine-events`) already emits `dispatch.succeeded` events carrying the billing spine (`workspaceRef`, `campaignId`, `channel`, `providerRef`) — but it is _explicitly lossy_ (best-effort sink, batches dropped on error, 30-day pruning). It cannot be a billing source of record.
- The **engine tick** already models "shared finite resource consumed across a tick" via per-channel token buckets (`buckets.ts`) and per-account decisions (`daily_cap`, `budget_exhausted`). Credit enforcement reuses this shape rather than inventing one.

Auth/ownership lives in Fonoster Identity: each workspace has exactly one `WORKSPACE_OWNER`, and `ownerProcedure` / `adminProcedure` middleware already exist. Config philosophy: mounted Zod-validated `qcobro.json` over env vars.

## Goals / Non-Goals

**Goals:**

- Meter every billable event durably and price it at write time.
- Plan-based pricing that survives evolution: new rates never rewrite history; enterprise custom pricing is a config/DB entry, not a code change.
- Hard stop when a workspace's monthly allowance is exhausted — no surprise bills, no overage.
- One card per payer regardless of workspace count; per-workspace accounting.
- Stripe as the sole payment processor; same-day billing across customers.
- The module is simulatable and evaluated by invariant, like the engine.

**Non-Goals:**

- Overage billing at list price after allowance exhaustion (schema leaves the door open; not built).
- Credit rollover between cycles (allowance resets monthly).
- Reserve-and-settle authorization holds for voice (telco-grade; a bounded-overshoot estimate suffices).
- Billing for non-dispatch events (inbound WhatsApp sessions, AI-insight tokens) — catalog is closed-world on the seven dispatch meters.
- Person-level or campaign-level budgets (workspace is the only accounting boundary).
- WhatsApp voice dispatch (meters reserved in the catalog, dormant until the Fonoster transport ships).

## Decisions

### D1 — Ledger separate from flight recorder; priced at write time

`UsageRecord` rows are written **in the same Prisma transaction** as the dispatch's contact-log write, never via the event sink. Each record stores meter, quantity, unit price, and amount (micro-units) _as of that moment_; the rate card is consulted exactly once, at write. Workspace balance = `SUM(ledger entries)` where the ledger holds allowance grants (+), usage debits (−), voids (−), and settlement adjustments (±).

- _Alternative — derive billing from engine events_: rejected; the sink drops batches by design and events are pruned.
- _Alternative — price at read/invoice time_: rejected; plan evolution and enterprise overrides would require historical rate resolution, and history would silently reprice.

### D2 — Rate card: per-minute quoting + telecom increment pairs

Voice meters store `perMinute` plus `increments: "initial/subsequent"` (launch: `"15/15"`), the industry-standard notation. Billed seconds:

```
billedSeconds = 0                                                    (never answered)
              = initial                                              (0 < d ≤ initial)
              = initial + ceil((d − initial) / subsequent) × subsequent
amount        = billedSeconds × perMinute / 60
```

Canonical vectors: 1→15, 15→15, 16→30, 35→45, unanswered→0. Billable duration is **answered duration only** (answer to hang-up; ring time free; voicemail pickup counts as answered). Message meters store `perMessage`. Each meter key has its own Zod schema — an increment on `sms` is a validation error.

- _Alternative — price per 15s block (original sketch)_: rejected; per-minute is how carriers, providers, and enterprise deals quote, and negotiated increments (60/6) become config edits.

### D3 — Money precision: integer micro-units, round only at aggregation

All stored amounts are integer micro-units of the billing currency (1 USD = 1,000,000). Config rates are decimal JSON numbers parsed to micro-units at load. Rounding happens only at display/invoice aggregation. Evaluation asserts `sum(ledger) == sum(priced records)` exactly.

### D4 — Plan catalog in `qcobro.json`; state in Postgres

New `billing` config section: `enabled`, `currency`, Stripe keys, `voiceDebitEstimateSeconds` (default 60), and an **ordered** `plans` array (index order = upgrade path). Each plan: `key`, i18n `name`, `monthlyPrice`, `monthlyAllowance` (separate fields — "pay 29, get 35" is a config edit), `stripePriceId`, and a `rates` object requiring **all seven meters**. What is _not_ config: workspace→plan assignment, enterprise `rateOverrides` (a `Partial` of the same shared rates schema, stored on `WorkspaceBilling`), Stripe IDs, balances — all DB state.

### D5 — Payer ≠ cost center: free-standing `BillingAccount`

`BillingAccount` (holds `stripeCustomerId`, anchor day, dunning state) is created lazily on first paid plan, keyed by its own id — _created from_ the owner, not identity-keyed — so future org billing (one finance team, many owners) is a pointer change. `WorkspaceBilling` (`workspaceRef`, `billingAccountRef`, `planKey`, `rateOverrides?`, `stripeSubscriptionItemId`, cycle state) is the cost center. The engine and console read workspace-level only; the payer appears solely at checkout, invoicing, and dunning.

### D6 — Stripe topology: one customer, one subscription, item per workspace

`workspaceRef` travels in subscription-item metadata. Consequences:

- One invoice/charge per payer per cycle; `billing_cycle_anchor` gives same-day billing.
- Add workspace mid-cycle → add item (Stripe prorates the charge) → grant **prorated allowance**.
- Upgrade → item price swap with proration → immediate grant of the new plan's (prorated) allowance.
- Downgrade → subscription schedule swaps the item's price at period end; current allowance keeps running until then.
- `invoice.paid` webhook is the **cycle boundary**: iterate items, and for each workspace open the new cycle — void unused remainder, write the new allowance grant.
- Enterprise: `collection_method: send_invoice` on the subscription; Stripe's ~20-item cap is acceptable because larger fleets are enterprise-invoiced anyway.
- _Alternative — one subscription per workspace_: rejected; N separate charges on the same card the same day.
- Known limitation: Stripe cannot move a subscription between customers; workspace ownership transfer is a documented cancel-and-recreate runbook (rare).

### D7 — Enforcement: credit bucket in the tick + direct check for manual outreach

At tick start, seed one credit bucket per workspace from the ledger balance; `balance ≤ 0` skips all that workspace's campaigns with `skipReason: "credits_exhausted"`. Per dispatch, `bucket.tryDebit(estimatedCost)` — exact price for message meters, `voiceDebitEstimateSeconds` at plan rate (never less than the initial increment) for voice. An empty bucket yields `AccountDecision: "credits_exhausted"`; the tick and other workspaces continue. Voice settles at call end: the webhook writes an adjustment replacing the estimate with the actual increment-billed amount. Blast radius: workspace-wide bucket, account-level boundary; campaign iteration order is the de-facto priority order (documented, not fair — v1). Manual/ad-hoc outreach performs a direct balance read and returns a structured insufficient-credits error. Overshoot bound (testable): `≤ concurrent voice calls × max(0, estimate error)` — small negatives tolerated on the cycle's last calls.

- _Alternative — suspended flag flipped at settlement_: rejected; lags behind spend, violating the hard-stop promise.
- _Alternative — per-dispatch DB balance query_: rejected; a query per account per tick, and still racy within the tick.

### D8 — Simulation & evaluation mirror the engine pattern

A billing simulator (sibling of `simulate-engine-tick.ts`) drives synthetic dispatches through the real pricing/ledger code with channel emulators. The evaluation module (sibling of `engine-scorecard`) asserts invariants: ledger conservation (D3), increment vectors (D2), overshoot bound (D7), hard-stop actually stops, proration × allowance edges (signup on day 28, upgrade mid-cycle, downgrade-then-cycle-turn), and `every rate > known provider floor` as a margin sanity guard.

### D9 — Console surfaces and role visibility

Credit meter (balance, burn indication) and "collections paused — credits exhausted" banner are **admin-visible** (admins run campaigns and must see why they stopped); card, invoices, and plan changes are **owner-only** (`ownerProcedure`). All copy via i18n. `WorkspaceSettings.currency` (portfolio amounts) and `billing.currency` (plan pricing) are distinct concepts and never conflated.

Finalized in design (Pencil, Administración clusters `qpge1`/`Z3Yaxq`): the Facturación page (`b4rbrX`) with credit meter (plan pill, remaining vs allowance, renewal date, projected days remaining) and owner-only Plan y pago card; the two paused banners (`nTeH0` exhausted / `S4OZDu` payment failed); the Gestionar plan modal (`YcJdj`). **All payment-shaped surfaces are Stripe-hosted**: invoices and payment-method management open the customer billing portal (external ↗ links), first-time card collection uses Stripe Checkout, and plan-change transactions may complete on a Stripe-hosted page — the modal is comparison + entry point only. The console never touches card data or invoice contents (no PCI surface, no SCA handling in-app). Billing-screen copy convention: center dot (·), never em-dash.

## Risks / Trade-offs

- [Voice overshoot: concurrent calls can drive balance slightly negative] → bounded by estimate-error × `maxCallsPerMinute`; bound is an asserted evaluation invariant, and next tick's seed self-corrects.
- [Ledger write adds latency/failure coupling to dispatch] → it's one row in the already-open transaction; a failed usage write correctly fails the dispatch (billing integrity over throughput).
- [Payment failure suspends all of a payer's workspaces at once] → dunning state lives on `BillingAccount`; console distinguishes "credits exhausted (upgrade)" from "payment failed (fix card)".
- [Stripe webhook loss/replay corrupts cycle turnover] → cycle open/close is idempotent keyed on `(workspaceRef, stripeInvoiceId)`; replays no-op.
- [Config/Stripe drift: `stripePriceId` pointing at wrong amounts] → startup validation fetches prices and warns on mismatch with `monthlyPrice`.
- [Starvation: first campaign in loop eats remaining credits] → documented v1 behavior; fairness is a later refinement.
- [Sub-cent rates invite float math] → micro-unit integers everywhere past the config boundary; ESLint-level ban on float arithmetic in billing modules is a ship-stage detail.

## Migration Plan

1. Schema + config land behind `billing.enabled: false` — metering writes `UsageRecord`s (observability) but enforcement and Stripe stay off.
2. Enable metering in production, watch ledger vs. provider invoices for a cycle fragment.
3. Enable enforcement + Stripe for new workspaces; backfill existing workspaces onto plans with a granted first allowance.
4. Rollback: flip `billing.enabled` off — dispatch paths skip metering/gating; ledger history is inert.

## Open Questions

- Free tier: is there a `monthlyPrice: 0` plan (no Stripe item) for onboarding, or do workspaces without `WorkspaceBilling` simply not dispatch? (Leaning: explicit free plan with a small allowance.)
- Exact launch prices per plan (the Pencil designs use placeholders — Inicial 9 / Crecimiento 29 / Escala 79; margin guard uses provider floors).
- ~~Depletion meter burn projection~~ — resolved in design: the meter shows projected days remaining (omitted when there is no usage yet).

## Follow-ups outside this change

- The marketing site's pricing page (Pencil `GB47x` "Planes y Precios") still shows the old Starter/Pro/Enterprise naming and an **overage** model that contradicts hard-stop; needs a separate marketing update once launch prices are set.
