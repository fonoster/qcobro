# Workspace Billing — Tasks

## 1. Contracts and config (`mods/common`)

- [x] 1.1 Add micro-unit money utilities (decimal→micro-unit parse, integer math, aggregation rounding) with unit tests
- [x] 1.2 Add per-meter rate Zod schemas (message vs voice, `"initial/subsequent"` increment parse-and-transform) and the shared `rates` schema; export `Partial` variant for overrides
- [x] 1.3 Add `billing` config section schema (enabled, currency, stripe keys, `voiceDebitEstimateSeconds`, ordered plans with i18n names, unique-key + seven-meter validation) and wire into the root config schema
- [x] 1.4 Implement pricing math: `billedSeconds` increment formula + meter pricing (rate resolution with overrides), with the canonical vectors as unit tests
- [x] 1.5 Add ledger/usage types and schemas (UsageRecord, ledger entry kinds: grant, debit, void, adjustment) shared by apiserver and webapp
- [x] 1.6 Update `config/qcobro.example.json` with the `billing` section (placeholder prices, two plans)

## 2. Persistence and ledger (`mods/apiserver`)

- [x] 2.1 Prisma migration: `BillingAccount`, `WorkspaceBilling` (planKey, rateOverrides JSON, stripeSubscriptionItemId, cycle state), `UsageRecord`, `LedgerEntry` (amounts as BIGINT micro-units)
- [x] 2.2 Implement ledger service as validated functions: append entries, derive balance, cycle open/close (idempotent per workspaceRef+stripeInvoiceId), with unit tests
- [x] 2.3 Implement usage recording: price-at-write inside the dispatch transaction for the three message meters (SMS, email, WhatsApp), failing the transaction on ledger failure; integration tests
- [x] 2.4 Implement voice estimate debit at dispatch and settlement adjustment (idempotent per call ref, unanswered→net zero); integration tests

## 3. Enforcement

- [x] 3.1 Add credit bucket (seed from balance, `tryDebit`, min initial-increment voice estimate) alongside channel buckets in `buckets.ts` style, with unit tests
- [x] 3.2 Wire the bucket into the engine tick: workspace seed at tick start, `credits_exhausted` account decision + campaign skip reason in TickReport, engine events, and emulator paths; extend `engine.integration.test.ts`
- [x] 3.3 Add direct balance check to manual/ad-hoc outreach with structured insufficient-credits error (tRPC), with tests
- [x] 3.4 Ensure `billing.enabled: false` bypasses metering and gating everywhere (test both modes)

## 4. Stripe lifecycle

- [x] 4.1 Add Stripe SDK to the tRPC context (config-driven client); startup price-drift validation (warn when `stripePriceId` amount ≠ `monthlyPrice`)
- [x] 4.2 Implement checkout/subscribe flow via Stripe-hosted Checkout: lazy BillingAccount + customer creation, subscription with anchor, add item-per-workspace with workspaceRef metadata, prorated first grant on completion
- [x] 4.3 Implement upgrade (item price swap + immediate prorated grant) and downgrade (subscription schedule at period end) as validated functions with stubbed-Stripe tests
- [x] 4.4 Implement Stripe webhook route: signature verification, `invoice.paid` → idempotent cycle turnover per item, payment-failure → dunning state suspending the account's workspaces (distinct from exhaustion); tests with replayed events
- [x] 4.5 Support `send_invoice` collection for enterprise accounts; document the ownership-transfer (cancel-and-recreate) runbook

## 5. Console (`mods/webapp`)

- [x] 5.1 Design billing surfaces in Pencil (credit meter, paused states, plan management modal) — done: Facturación `b4rbrX`, banners `nTeH0`/`S4OZDu`, modal `YcJdj`, notes `k8650` in the Administración clusters
- [x] 5.2 Add billing tRPC router (balance/allowance/cycle/burn projection for admins; plan-change, Stripe billing-portal session, and Checkout session creation for owners via `ownerProcedure`)
- [x] 5.3 Build Facturación page: credit meter (plan pill, remaining vs allowance, renewal date, projected days) + paused banners (exhausted vs payment-failed, role-aware CTAs), all copy through i18n (en/es), center-dot convention
- [x] 5.4 Build plan management modal (comparison + entry point) with transactions completing on Stripe-hosted pages (Checkout for first subscribe, portal/hosted flow for changes); "Ver facturas ↗" and "Actualizar ↗" open the customer billing portal
- [x] 5.5 E2E tests: meter renders, exhausted state appears, owner-only gating of payment surfaces

## 6. Simulation and evaluation

- [x] 6.1 Billing simulation script (sibling of `simulate-engine-tick.ts`): synthetic mixed-meter dispatches through real pricing/ledger with emulators, multi-cycle scenarios
- [x] 6.2 Evaluation module (sibling of engine-scorecard): ledger conservation, increment vectors, hard-stop, overshoot bound, proration × allowance edges, provider-floor margin guard
- [x] 6.3 Edge-case scenario suite: mid-cycle signup, upgrade-while-exhausted, downgrade-then-turnover, replayed webhooks, in-flight calls at exhaustion

## 7. Rollout

- [ ] 7.1 Verify metering-only mode (enforcement off) end-to-end in a staging run; compare ledger totals against emulated provider counts
- [x] 7.2 README/docs: billing config reference, plan setup with Stripe, migration steps for existing workspaces
