# Workspace Billing

## Why

QCobro is launching commercially and has no way to charge for usage: every dispatch (SMS, email, WhatsApp, voice) costs Fonoster real provider money with no accounting, no plans, and no way to stop a workspace from spending indefinitely. Launch requires metering every billable event, plan-based pricing that supports future enterprise customization, and Stripe-backed payment — built on principles that survive pricing evolution (price at write time, catalog in config, ledger in DB).

## What Changes

- **Durable usage ledger**: every billable dispatch writes a `UsageRecord` priced at write time (unit, quantity, unit price, amount in micro-units), in the same transaction as the dispatch/contact log — deliberately separate from the lossy, pruned engine flight recorder. Workspace balance = sum of ledger entries (allowance grants, usage debits, voids).
- **Seven-meter catalog**: `sms`, `email`, `whatsappMessage`, `voicePrerecorded`, `voiceAi`, `whatsappVoicePrerecorded`, `whatsappVoiceAi` (the two WhatsApp-voice meters are reserved/dormant until Fonoster ships that transport). Message meters bill per message; voice meters bill by telecom increment pairs (launch: 15/15) against answered duration only — voicemail pickup counts as answered; unanswered calls bill zero.
- **Plan catalog in `qcobro.json`**: a new `billing` section — ordered `plans` array (order = upgrade path), i18n plan names, `monthlyPrice` and `monthlyAllowance` as separate fields, `stripePriceId` per plan, per-meter rate schemas with `"15/15"` increment notation, all seven meters required on every plan.
- **Monthly allowance model with hard stop**: each cycle opens with an allowance grant; unused remainder voids at cycle close (no rollover). When the balance is exhausted, collections stop — no overage billing at launch.
- **Engine enforcement**: a per-workspace credit bucket seeded from the ledger at tick start, debited in memory per dispatch (voice debits a configurable estimate, settled to actual at call end). Exhaustion yields a `credits_exhausted` account decision / campaign skip reason, mirroring existing token-bucket and cap semantics. Manual/ad-hoc outreach gets a direct balance check with a structured "insufficient credits" error.
- **Payer/cost-center split**: a free-standing `BillingAccount` (lazily created on first paid plan) owns the Stripe customer, one card, and the billing anchor; each workspace keeps its own plan, ledger, and accounting. Stripe topology: one customer, one subscription, one subscription item per workspace (`workspaceRef` in item metadata). Upgrade = item price swap with proration and immediate prorated allowance grant; downgrade = scheduled item change at period end; enterprise = `send_invoice` collection plus per-workspace `rateOverrides` (a partial of the shared rates schema).
- **Billing simulation and evaluation** following the engine-evaluation pattern: synthetic usage generation plus an evaluation script asserting invariants — `sum(ledger) == sum(priced events)` to the micro-unit, voice overshoot never exceeds `concurrent calls × estimate error`, proration × allowance edge cases, and the canonical increment vectors (1s→15s, 16s→30s, 35s→45s, unanswered→0).
- **Depletion UI** in the operator console: credit meter with burn indication (admin-visible) and a "collections paused — credits exhausted" state; card/invoice management owner-only. Designed in Pencil during ship.

## Capabilities

### New Capabilities

- `billing-plans`: the plan catalog in `qcobro.json` — plan/rate-card schemas, increment notation, pricing math (billed-seconds formula, micro-unit precision, rounding only at aggregation), per-workspace enterprise rate overrides.
- `usage-ledger`: durable `UsageRecord`s priced at write time, ledger entries (grants, debits, voids), workspace balance derivation, cycle open/close semantics (allowance grant, remainder void).
- `billing-accounts`: the `BillingAccount` payer entity and Stripe lifecycle — customer, subscription, item-per-workspace, upgrade/downgrade/proration, billing-cycle anchor, invoice-paid webhook as cycle boundary, enterprise `send_invoice`.
- `billing-enforcement`: hard-stop semantics — per-workspace credit bucket in the engine tick, voice debit estimate and settlement, direct balance check for manual outreach, blast-radius rules (workspace-scoped, account-boundary).
- `billing-console`: operator-console billing surfaces — credit meter, collections-paused state, plan view/upgrade/downgrade, role visibility (admin meter, owner-only payment).
- `billing-evaluation`: simulation of synthetic billable usage and the evaluation script with its invariants, following the engine-evaluation pattern.

### Modified Capabilities

- `campaigns-engine`: adds the `credits_exhausted` account decision and campaign skip reason; the tick seeds and consumes per-workspace credit buckets alongside existing channel token buckets.
- `voice-events-hook`: the call-completion hook must report answered duration in seconds and trigger usage settlement (actual billed amount replaces the dispatch-time estimate).

## Impact

- `mods/common`: new Zod schemas (`billing` config section, rate cards, ledger entries, usage records) and shared pricing math; evaluation module gains billing invariants.
- `mods/apiserver`: Prisma migrations (`BillingAccount`, `WorkspaceBilling`, `UsageRecord`, ledger tables), Stripe SDK dependency and webhook route, engine tick gains the credit bucket, dispatch paths write usage records transactionally, voice/webhook settlement, new tRPC billing router.
- `mods/webapp`: billing console surfaces (meter, paused banner, plan management) — all copy through i18n.
- `config/qcobro.example.json`: new `billing` section (plans catalog, Stripe keys, `voiceDebitEstimateSeconds`).
- New scripts: billing simulation and evaluation (mirroring `simulate-engine-tick.ts` / engine-scorecard).
- External: Stripe account with per-plan prices; webhook endpoint exposure.
