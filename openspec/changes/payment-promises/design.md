## Context

QCobro records every outreach attempt as a **gestión** (`AccountContactLog`). Today the
gestión's `outcome` can spawn a generic **`Objective`** entity with a `dueDate` and a
`PENDING → MET | BROKEN | CANCELLED` lifecycle. The objective is created _after_ the
conversation and then surfaced as "the objective" — inverting cause and effect and
conflating the goal (what we asked for) with the result (what happened).

Three facts drive the redesign:

1. **The channel bounds the achievable outcome.** SMS and `VOICE_PRERECORDED` are
   fire-and-forget; only `VOICE_AI`, `EMAIL`, and `WHATSAPP` can hold a conversation that
   yields a promise, new terms, a callback, etc.
2. **QCobro can only adjudicate a payment.** It knows `outstandingBalance`, sees payment
   events, and computes `recoveredAmount`. It does not own loan servicing, so it cannot
   verify "new terms." A tracked lifecycle for something it cannot verify is theater.
3. **Follow-up is a human judgement, not an automation.** When a promise comes due, the
   right next step (gentle nudge, firmer call, give up, mark paid) belongs to a collector.

Existing infrastructure we build on: `CampaignAccountState.suppressUntil` and global
`PortfolioAccount.intentStatus` (suppression already exists); campaign membership defined
by portfolio association, with per-account progress in `CampaignAccountState`; agent
templates as "pure configuration"; the campaign-independent `dispatchOutreach` trigger
layer; the validated-function pattern; tRPC context for service injection.

## Goals / Non-Goals

**Goals:**

- Make `outcome` the single structured, frozen, point-in-time record on every gestión.
- Introduce `PaymentPromise` as the only first-class tracked entity, with lifecycle
  `PENDING → MET | EXPIRED | CANCELLED` and **DUE derived** (PENDING past its date).
- Turn the dashboard "Objectives" section into a **Payment Promises worklist** that signals
  the operator when a promise is due and lets them resolve it.
- Make follow-up an **ad-hoc agent dispatch** (pick an agent template, no campaign) so it
  never distorts campaign accounting.
- Keep Lever B (`suppressUntil`) for the pending window so automated dispatch doesn't
  pester an account before its promise is due.

**Non-Goals:**

- No automated escalation: no background sweep, no auto-transition to "broken", no
  auto re-queue. The operator drives every follow-up.
- No tracked lifecycle for non-payment outcomes — recorded as `outcome` only.
- No campaign attachment for follow-ups; no listless "escalation campaign" concept (a
  harder approach is just a firmer agent template).
- No outbound webhook in this change (deferred). No loan-servicing integration.

## Decisions

### D1. `outcome` is the single structured field; channel bounds the set

Every gestión carries exactly one `outcome`. We add `DELIVERED`/`NOT_DELIVERED` (for
fire-and-forget channels) and `NEW_TERMS`/`DISPUTE_RAISED`/`INFORMATION_REQUEST` (recorded
but not tracked). The channel→outcome bound is treated as physics, not an authored
validation matrix: SMS/`VOICE_PRERECORDED` only ever write delivery outcomes because no
conversation occurs. We document the bound; we do not build a rejection rule unless a
channel emits an impossible outcome in practice.

_Alternative considered:_ a structured per-campaign goal validated against channel
capability. Rejected as over-modeling — the goal is better expressed softly in the agent
prompt, and the channel bound falls out for free.

### D2. `PaymentPromise` is the only first-class tracked entity

Created only when an outcome implies a payment promise. Fields: `id`, `contactLogId` (the
creating gestión), `portfolioAccountId`, `amount`, `dueDate`, `status`, `notes?`,
`createdAt`, `updatedAt`. Met (operator confirmation or payment event) feeds
`recoveredAmount`. This is the single source of the "Payment Promises" worklist.

_Alternative considered:_ a generic `Commitment` with many types. Rejected: QCobro can only
honestly adjudicate payments; other commitments would have an unverifiable lifecycle.

### D3. Lifecycle is operator-driven; DUE is derived, no background job

Status is `PENDING → MET | EXPIRED | CANCELLED`. **DUE is not a stored status** — it is
derived (`status == PENDING && dueDate <= now`) and is what surfaces a promise on the
worklist. There is intentionally **no stored "broken" status and no scheduled sweep**: a
due-unpaid promise simply remains on the worklist until a human resolves it.

- `MET` — operator marks paid, or a payment event confirms payment; feeds
  `recoveredAmount`.
- `EXPIRED` — set automatically when the account leaves its portfolio (also operator-
  settable); the promise stays **visible** on the worklist, flagged do-not-reach.
- `CANCELLED` — operator dismissal.

_Alternative considered:_ a scheduled sweep that auto-transitions overdue promises to
BROKEN and re-queues them (the earlier design). Rejected: it builds the most failure-prone
piece (a clock + escalation engine) for behavior the operator should own. Deriving DUE at
read time removes the job entirely.

### D4. Follow-up is an ad-hoc agent dispatch, not a campaign

From a DUE promise the operator can "follow up": pick an **agent template** (gentle
reminder, firmer call, etc.), dispatch it against the account via `dispatchOutreach`, and
write a standalone gestión with `campaignId = null`, the chosen `agentTemplateId`, and a
link to the promise. Escalation = choosing a firmer template.

_Why no campaign attachment:_ campaign membership is defined by portfolio association and
per-account progress lives in `CampaignAccountState`. Attributing a follow-up to a campaign
the account isn't a member of would mint a `CampaignAccountState` row for a non-member,
corrupting that campaign's account count, attempt caps, and recovered-amount attribution.
An agent-only dispatch avoids the problem entirely.

_Alternatives considered:_ (a) attach to any campaign — rejected, corrupts accounting;
(b) constrain to eligible (member) campaigns — workable but still couples follow-up to
campaign state; (c) a listless cross-portfolio "escalation campaign" — a bigger change to
what a campaign is, unnecessary once a firmer agent template covers escalation.

### D5. Lever B retained for the pending window only

When a promise is created (or a callback/new-terms grace applies),
`CampaignAccountState.suppressUntil` is set to the future date so automated campaign
dispatch skips the account until it's due. After the date, suppression naturally lapses and
the promise shows as DUE on the worklist. `CALLBACK` feeds only Lever B and creates no
tracked entity.

### D6. Fulfillment-rate math

Worklist KPI `fulfillment rate = MET / (MET + overdue-unresolved)`, where
overdue-unresolved = `PENDING && dueDate < now`. `EXPIRED` and `CANCELLED` are **excluded**
(N/A — not failures), so leaving the portfolio never counts against the rate. This yields
an honest "of promises that came due, how many were kept" without a stored BROKEN status.

### D7. Migration: drop `Objective`, preserve payment promises

Existing `Objective` rows of type `PAYMENT_PROMISE`/`PARTIAL_PAYMENT` migrate into
`PaymentPromise` (carrying `amount`, `dueDate`, mapping status). `CALLBACK_SCHEDULED`
objectives collapse into `suppressUntil` only (no entity). Other objective types are dropped
from tracked storage; their history remains on the originating gestión `outcome`. This is a
**BREAKING** data-model change.

## Risks / Trade-offs

- **No automated chase means a due promise can sit unworked if no operator looks** →
  Mitigation: the worklist makes DUE promises prominent with due/overdue sorting and KPIs;
  this is a deliberate human-in-the-loop choice, not an oversight.
- **Losing tracked status for non-payment outcomes** → Mitigation: the gestión `outcome` is
  the permanent record; a future outbound-webhook change can push these to systems that can
  act on them. Low regret — history is preserved.
- **"Met" via payment event depends on a reliable payment signal** → Mitigation: MET can
  also be set manually by the operator; if no payment signal exists, the promise stays
  PENDING/DUE (never falsely resolved) until a human acts.
- **Follow-ups have no campaign roll-up** → Mitigation: accepted trade-off for clean
  accounting; the promise still threads to the original campaign via its creating gestión,
  and follow-up gestiones are visible on the promise and the account's gestión log.
- **Migration data loss for dropped objective types** → Mitigation: originating gestión rows
  remain; only the redundant tracked entity is removed. Back up before migrating.

## Migration Plan

1. Add `PaymentPromise` model + `Outcome` enum additions; keep `Objective` temporarily.
2. Backfill `PaymentPromise` from payment-bearing `Objective` rows; map callbacks to
   `suppressUntil`.
3. Switch gestión hot-path to write `PaymentPromise` + Lever B; ship the worklist +
   agent-based follow-up + auto-expiry on portfolio removal.
4. Switch webapp dashboard/detail to the new model.
5. Drop `Objective` model/procedures/UI once backfill is verified.

Rollback: additive steps (1–3) are reversible while `Objective` still exists; defer the
destructive drop (step 5) until the new path is verified in production.

## Resolved

- **Auto-MET deferred; v1 is manual mark-paid only.** There is no payment-event signal we
  can currently trust, so a promise leaves `PENDING` only by an operator marking it paid
  (or cancelling/expiring). A payment-event source for auto-MET is future work; the
  `PaymentPromise` lifecycle already accommodates it without schema change.

## Manual outreach (now in scope)

The portfolio-row **manual outreach** ("Contactar manualmente", single + bulk) is reworked
to the same agent-based, campaign-less pattern: the modal selects an **agent template**
(required) instead of a campaign, and `outreach.dispatch` loads the template directly,
dispatches, and records a gestión with `campaignId` null + `agentTemplateId` — no
`reserveAttempt`, no `CampaignAccountState`. This removes the campaign requirement (captured
in the web-console spec delta).

## Follow-on work (out of scope here, do not lose)

- **Outbound webhook** for non-payment outcomes (NEW_TERMS, DISPUTE, …) and promise
  notifications.
