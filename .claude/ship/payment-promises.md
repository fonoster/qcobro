# Ship checkpoint — payment-promises

Started: 2026-06-27
Current stage: 4 — Test (unit green; e2e blocked on infra)

**Scope:** Reframe "Objectives" into a single structured gestión `outcome` plus a
first-class `PaymentPromise` (the only tracked entity). The dashboard "Objectives" section
becomes a **Payment Promises worklist** with DUE signaling and operator actions (mark paid,
cancel, follow up via ad-hoc agent-template dispatch with `campaignId` null). Lifecycle
`PENDING → MET | EXPIRED | CANCELLED`; DUE derived; v1 mark-paid is manual-only; no
automation/sweep. The generic `Objective` entity is removed (BREAKING, with migration).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo-root `pencil.pen`) · Storybook: yes (@qcobro/webapp) · E2E: yes (Playwright)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                     |
| :-- | :-------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Surfaces detected; scope stated; proposal/design/specs/tasks read and valid                                                                                                                               |
| 1   | Design (Pencil) | done        | Worklist, nav consolidation+sweep, detail callout, agent-centric outreach modal                                                                                                                           |
| 2   | Spec reconcile  | done        | No spec edits needed — design stayed within spec; nav/general-outreach kept out of scope                                                                                                                  |
| 3   | Build           | done        | common+apiserver+webapp build clean; recordOutcome→PaymentPromise; resolve/followUp/expire functions; router; worklist page; nav; i18n; migration authored                                                |
| 4   | Test            | in-progress | lint 0, builds/typecheck 0, unit 152 pass (incl. validation-failure cases). e2e BLOCKED: needs DB+server+Mailpit (unavailable here). Migration hand-authored — verify via `prisma migrate dev` on dev DB. |
| 5   | Sync            | pending     | via /opsx:sync (gate)                                                                                                                                                                                     |
| 6   | Archive         | pending     | via /opsx:archive (gate)                                                                                                                                                                                  |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-27 — Scope additions per user: (1) eradicated the "objetivos" term — route `/payment-promises`, page `PaymentPromises.tsx`, i18n `paymentPromises.*`/`nav.paymentPromises`, removed dead objective keys; (2) manual outreach made agent-based (campaign requirement REMOVED) at the spec level (web-console MODIFIED "Manual outreach from a customer row") + impl (`outreach.dispatch` takes agentTemplateId, no reserveAttempt, campaign-less gestión; ReachOut/Bulk modals pick an agent; manualOutreachSchema). Proposal/design/memory reconciled (no longer "out of scope"). All builds/lint/152 unit tests green; change validates.

- 2026-06-27 — Fix: nav "Promesas de pago" was disabled (the item had no `to`; the worklist was a coming-soon stub). Linked it to `/objetivos` so the new worklist is reachable. (Manual-outreach modal still campaign-centric in webapp code — that rework is the deferred separate change, by design.)

- 2026-06-27 — Migration APPLIED + VERIFIED against dev DB (`migrate deploy` → "schema up to date", drift check empty). Prisma-generated structural migration (greenfield; no Objective data to backfill). E2E worklist spec authored (e2e/payment-promises.spec.ts) but BLOCKED: the dev stack's auth bootstrap (signUpAndEnter → workspace create via Identity → dashboard) is flaky and fails identically for an existing spec (profile.spec.ts) — environmental, not payment-promises. Restarted the apiserver (pid 2977; it had wedged from my build/prisma-regen churn) which restored workspace-create intermittently, but the bootstrap is too flaky for a clean run. Recommend investigating Identity/workspace-create flakiness or running e2e in CI.

- 2026-06-27 — Stage 4: lint 0, all builds/typecheck 0, unit 152 pass (recordOutcome/createContactLog updated; new resolvePaymentPromise/followUpPaymentPromise tests + syncAccounts expire assertion, each with a validation-failure case). e2e (7.4) blocked — needs DB+server+Mailpit not available here.
- 2026-06-27 — Build complete across common/apiserver/webapp. Reconcile finding: kept PARTIAL_PAYMENT_AGREED outcome (a payment commitment → creates a PaymentPromise); spec enum updated to match. Prisma migration hand-authored (no DB here) — must be verified with `prisma migrate dev` on the dev stack.

- 2026-06-27 — Nav-highlight sweep across ALL dashboard screens: each sidebar instance highlights its own section (Carteras/Campañas/Agentes/Gestiones/Promesas/Panel); settings/account pages (Perfil, Config, Miembros, Claves API) de-highlight Panel. Verified Carteras Lista renders correct.
- 2026-06-27 — Manual-outreach modal made agent-centric on the REAL object (G4dg3 in Carteras Modals): Campaña select → Agente; footnote "…sin campaña"; deleted stray duplicate. Same agent picker serves promise "Dar seguimiento".
- 2026-06-27 — Added ⋮ kebab trigger to worklist rows; row hover menu drops from it.
- 2026-06-27 — Design pass done (awaiting gate): worklist "Promesas de pago" (KPIs Pendientes/Monto pendiente/Vencen esta semana/Tasa de cumplimiento; table dropped TIPO; states Vencida/Cumplida/Pendiente/Expirada); row hover menu Marcar pagada/Dar seguimiento/Cancelar; nav consolidated to "Promesas de pago" (hand-coins icon); gestión-detail callout → "Promesa de pago".
- 2026-06-27 — Design decisions: actions via row hover menu; single "Promesas de pago" nav item replacing Objetivos+Resultados, money icon.
- 2026-06-27 — Stage 0 done → Stage 1. Surfaces: OpenSpec/Pencil/Storybook/E2E all present.
- 2026-06-27 — v1 MET is manual mark-paid only (no trusted payment signal); auto-MET future.
- 2026-06-27 — Follow-up = ad-hoc agent-template dispatch, campaignId null (no campaign attach).
- 2026-06-27 — No sweep/automation; DUE derived; statuses PENDING→MET|EXPIRED|CANCELLED.
- 2026-06-27 — Outbound webhook + portfolio-list manual-outreach redesign deferred to own changes.
- 2026-06-27 — Checkpoint created; framing the change.
