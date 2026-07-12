# Ship checkpoint — workspace-billing

Started: 2026-07-11
Current stage: 5 — Sync (awaiting human gate)

**Scope:** Usage-based billing for QCobro: durable priced-at-write-time usage ledger, plan
catalog in qcobro.json (7 meters, 15/15 voice increments), monthly allowance with hard stop
enforced via a per-workspace credit bucket in the engine, BillingAccount payer with Stripe
item-per-workspace topology, billing console surfaces, and simulation + evaluation.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo-root pencil.pen) · Storybook: yes · E2E: yes

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                          |
| :-- | :-------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change authored this session; branch feat/workspace-billing (== main)                                                                                                                                                                                          |
| 1   | Design (Pencil) | done    | Approved by Pedro 2026-07-11. Facturación page b4rbrX, paused banners nTeH0/S4OZDu, plan modal YcJdj, notes k8650 — Administración clusters qpge1/Z3Yaxq                                                                                                       |
| 2   | Spec reconcile  | done    | Design decisions folded into billing-console spec (Stripe-hosted surfaces, burn projection, modal-as-entry-point), design.md, tasks.md. `openspec validate` green                                                                                              |
| 3   | Build           | done    | 23/24 tasks (commits 83deab6, fe49051, 1339f7c, f90e115, 187b777). Only 7.1 (staging metering-only verification) remains — deploy-time step                                                                                                                    |
| 4   | Test            | done    | typecheck + eslint green; 100 common + 212 apiserver tests pass (incl. Postgres-backed engine integration + migration deploy); webapp builds; billing:sim scenario suite green (BIL-1…6). e2e billing.spec.ts authored but NOT executed (needs full dev stack) |
| 5   | Sync            | pending |                                                                                                                                                                                                                                                                |
| 6   | Archive         | pending |                                                                                                                                                                                                                                                                |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-11 — /code-review high (8 angles): 10 findings reported, 9 fixed in 60d2db5 (founding-item metadata stamp, downgrade schedule anchor, voice settlement duration guard, upgrade + metering idempotency, subscribe-race compensation, metered-path validation, credit/token ordering, ctx gateway + i18n literal, plus cleanup: shared meter map/estimator/P2002 helper/localized resolver, settings cache, staleTime, parallel price validation, dead exports). SKIPPED as follow-up: O(history) ledger balance aggregate (cycle-bounded sum is equivalent since closed cycles net to zero — optimize when volume warrants). Accepted by design: gestión+metering share one tx (spec-mandated), misconfigured gate labeled credits_exhausted (fail-closed, logged). README gained the plans-configuration guide (QCobro↔Stripe).

- 2026-07-11 — Stages 3+4 done across five commits. Build decisions worth knowing: unenrolled workspaces dispatch UNMETERED (safe gradual rollout/backfill); engine fails CLOSED on misconfigured enrollments (credits_exhausted); added payment_failed campaign skip reason; downgrades avoid fragile schedule state by re-deriving planKey from the Stripe item price at invoice.paid turnover; voice usage rows freeze rate+increments at dispatch so settlement prices at dispatch-time rates. Open: task 7.1 (staging metering-only run) + e2e spec not yet executed. Next: /opsx:sync gate.

- 2026-07-11 — Stage 2 done: billing-console spec gains "Payment surfaces are Stripe-hosted" requirement + meter shows renewal date/burn projection + modal-as-entry-point (MAY complete on Stripe-hosted page); design.md D9 updated, burn-rate open question resolved, GB47x marketing follow-up noted; tasks 4.2/5.2/5.3/5.4 aligned, 5.1 checked. Four requirements reworded so SHALL lands on the first line (parser quirk). `openspec validate` green.
- 2026-07-11 — Stage 1 done: Pedro approved the designs.
- 2026-07-11 — Round 2 (Pedro): modal stays as designed — no in-app confirmation state or first-subscribe variant. Noted on canvas instead: plan changes may redirect to a Stripe-hosted page (Checkout/portal) to finish the transaction; the modal is comparison + entry point. Carry into billing-console/billing-accounts specs at stage 2.
- 2026-07-11 — Round-1 revisions applied and screenshot-verified: all em-dashes replaced with "·" (copy + node names; banners now nTeH0 "Campañas · Pausado · créditos agotados", S4OZDu "· pago fallido"), "Ver facturas ↗" / "Actualizar ↗" affordances added, note E2JLY "PORTAL DE STRIPE" records the hosted-portal decision. Still at design gate.
- 2026-07-11 — Design review round 1: invoices + payment-method management are Stripe-hosted (customer billing portal, external ↗ links) — QCobro renders no invoice data; capture in billing-console spec at stage 2. Copy convention for billing screens: center dot (·), never em-dash. Agent applying both.
- 2026-07-11 — Stage 1 designs complete (Sonnet agent a25ce3b04f9876bfe): Facturación page, two paused banners, Gestionar plan modal. Placeholder prices (9/29/79). Flagged: marketing doc GB47x still shows old Starter/Pro/Enterprise overage model contradicting hard-stop. Awaiting human design gate.
- 2026-07-11 — Blocker resolved: Pedro switched Pencil to the QCobro file; agent resumed.
- 2026-07-11 — Stage 1 BLOCKED: Pencil desktop has Mikro's pencil.pen focused; MCP filePath param is ignored in favor of the active editor. No writes made. Waiting for Pedro to open /Users/psanders/Projects/qcobro/pencil.pen in Pencil, then resume Sonnet agent a25ce3b04f9876bfe.

- 2026-07-11 — User directive: run design stage only for now, then stop; Pencil work delegated to a Sonnet subagent.
- 2026-07-11 — Stage 0 done. Surfaces detected; proposal/design/specs/tasks all complete (authored earlier this session).
- 2026-07-11 — Checkpoint created; framing the change.
