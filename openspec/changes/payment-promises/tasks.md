## 1. Shared contracts (`mods/common`)

- [x] 1.1 Extend `ContactOutcome` enum: add `DELIVERED`, `NOT_DELIVERED`, `NEW_TERMS`, `DISPUTE_RAISED`, `INFORMATION_REQUEST`; retire `PARTIAL_PAYMENT_AGREED`/`CALLBACK_SCHEDULED` objective vestiges
- [x] 1.2 Add `PaymentPromise` Zod schema + types (id, contactLogId, portfolioAccountId, amount, dueDate, status `PENDING|MET|EXPIRED|CANCELLED`, notes?, timestamps); expose a derived `isDue` helper
- [x] 1.3 Remove `Objective`/`ObjectiveType` types and references from `@qcobro/common`

## 2. Data model & migration (`mods/apiserver`)

- [x] 2.1 Add `PaymentPromise` Prisma model + relations to `AccountContactLog` and `PortfolioAccount`; add status enum
- [x] 2.2 Add gestión fields: `agentTemplateId?` and `paymentPromiseId?` (follow-up link)
- [x] 2.3 Migration: backfill `PaymentPromise` from payment-bearing `Objective` rows (map status); map `CALLBACK_SCHEDULED` objectives to `CampaignAccountState.suppressUntil`
- [x] 2.4 Drop the `Objective` model/table after backfill is verified (destructive — gate behind verified backfill)

## 3. Promise creation & hot-path (`mods/apiserver`)

- [x] 3.1 Validated function: create `PaymentPromise` only for payment outcomes with amount+date; idempotent on re-delivered events
- [x] 3.2 Wire creation into both `accountContactLog.create` tRPC procedure and the `POST /api/contact-logs` REST path
- [x] 3.3 Lever B: set `CampaignAccountState.suppressUntil` from any future-dated outcome (promise dueDate, callback time, new-terms grace), independent of promise creation
- [x] 3.4 MET transition (operator mark-paid and/or payment event) feeding `recoveredAmount`; CANCELLED transition

## 4. Worklist, expiry & follow-up (`mods/apiserver`)

- [x] 4.1 tRPC `paymentPromise` router: list with DUE derived (`PENDING && dueDate <= now`), filters, and worklist KPIs (pending, amount pending, due this week, fulfillment rate excluding EXPIRED/CANCELLED)
- [x] 4.2 Auto-expire `PENDING` promises to `EXPIRED` when their account is removed from the portfolio; allow manual expire
- [x] 4.3 Follow-up procedure: dispatch a chosen agent template ad-hoc via `dispatchOutreach`, write a gestión with `campaignId` null + `agentTemplateId` + `paymentPromiseId`, asserting no `CampaignAccountState` is touched
- [x] 4.4 Query to list follow-up gestiones linked to a promise (history)

## 5. Webapp (`mods/webapp`)

- [x] 5.1 Replace "Objectives" section with a "Payment Promises" worklist: list (account, amount, due date, status, days until/past due) with DUE signaling + KPI strip
- [x] 5.2 Worklist actions: mark paid, cancel, and follow up (agent-template picker → ad-hoc dispatch)
- [x] 5.3 Show `EXPIRED` promises as visible/do-not-reach, excluded from the fulfillment KPI
- [x] 5.4 Reshape gestión detail slide-over: show `outcome` + linked `PaymentPromise` (only for payment outcomes) + follow-up trail; remove generic linked-objectives UI
- [x] 5.5 Add i18n strings for all new Payment Promises labels/KPIs/actions (no hardcoded literals)

## 6. AI insights alignment (`mods/apiserver` / specs)

- [x] 6.1 Confirm analysis never creates/modifies `PaymentPromise` and never alters `outcome` (advisory only)

## 7. Tests

- [x] 7.1 Unit (sinon): promise creation rules (payment-only, idempotent); Lever B suppression from each future-dated outcome; callback creates no entity
- [x] 7.2 Unit: resolution transitions (mark-paid→MET feeds recoveredAmount, cancel→CANCELLED); DUE derivation; fulfillment-rate math excludes EXPIRED/CANCELLED
- [x] 7.3 Unit: auto-expire on portfolio removal; follow-up writes campaign-less gestión and never touches `CampaignAccountState`
- [ ] 7.4 E2E: promise lifecycle (create → DUE → mark paid); follow-up via agent template from the worklist; account removal expires promise but keeps it visible; Payment Promises KPIs render from live data

## 8. Manual outreach → agent-based + term cleanup

- [x] 8.1 Remove campaign requirement from manual outreach: `outreach.dispatch` takes `agentTemplateId` (not `campaignId`), drops `reserveAttempt`, records a campaign-less gestión; spec updated (web-console "Manual outreach from a customer row")
- [x] 8.2 Rework ReachOutModal + BulkReachOutModal to select an agent template (no campaign); i18n updated
- [x] 8.3 Eradicate the "objetivos" term: route `/payment-promises`, page `PaymentPromises.tsx`, i18n `paymentPromises.*` / `nav.paymentPromises`, nav linked (was a disabled stub)
