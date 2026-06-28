## Why

Today an `Objective` is emitted as the _result_ of a gestión (outcome `PAYMENT_PROMISE`
→ an `Objective` is created). That makes the goal a noun wearing a result's clothes: the
system has no concept of an objective until a conversation produces one, so "payment
promised" ends up labeled as the _objective_ rather than the _outcome_. The model is
backwards, and it conflates two different things — what we asked the agent to achieve
(soft, set before) and what actually happened (structured, recorded after).

This change flips the model: the goal stays soft (natural language in the agent prompt),
the **outcome** becomes the single structured record of what happened, and **only the
payment promise** — the one thing QCobro can truthfully adjudicate — gets a tracked record.
A payment promise is an **operator worklist item**, not an automation trigger: QCobro
records the promise and surfaces it when due; a human collector decides the follow-up.

## What Changes

- **Outcome becomes the source of truth.** Every gestión has exactly one structured
  `outcome`. The channel physically bounds which outcomes are possible: SMS and
  `VOICE_PRERECORDED` can only produce `DELIVERED`/`NOT_DELIVERED`; `VOICE_AI`, `EMAIL`,
  and `WHATSAPP` can produce the full conversational set (incl. `NEW_TERMS`,
  `DISPUTE_RAISED`, `INFORMATION_REQUEST`).
- **New first-class `PaymentPromise` entity.** Created only when an outcome implies a
  payment promise (amount + dueDate). Lifecycle `PENDING → MET | EXPIRED | CANCELLED`.
  **DUE is a derived state** (PENDING with a past due date) — no stored "broken" status and
  no background job. Met promises feed `recoveredAmount`.
- **BREAKING: the generic `Objective` entity is removed.** Outcomes QCobro cannot
  adjudicate (`NEW_TERMS`, `DISPUTE_RAISED`, `INFORMATION_REQUEST`, etc.) no longer spawn
  any tracked entity — they are recorded as the gestión `outcome` and visible in history.
- **Payment Promises worklist (operator-driven).** The console "Objectives" section
  becomes a Payment Promises worklist that surfaces DUE promises to the collector. From it
  an operator can: mark a promise **paid** (`MET`); **follow up** with ad-hoc outreach; or
  see a promise marked **EXPIRED** when its account leaves the portfolio (kept visible,
  flagged do-not-reach).
- **Follow-up is an ad-hoc agent dispatch, not a campaign.** A follow-up selects an
  **agent template** (channel + script/voice — e.g. a gentle reminder or a firmer call) and
  dispatches it against the account via the existing dispatch layer, writing a standalone
  gestión with `campaignId = null`, the chosen `agentTemplateId`, and a link back to the
  promise. No campaign is attached, so no `CampaignAccountState` is minted — campaign
  account counts, attempt caps, and recovered-amount attribution stay clean. Escalation is
  simply choosing a firmer agent template.
- **Manual outreach becomes agent-based (no campaign).** The "Contactar manualmente" row
  action (single and bulk) now selects an **agent template** instead of a campaign and
  dispatches it ad-hoc, recording a campaign-less gestión (`campaignId` null +
  `agentTemplateId`, no `CampaignAccountState`). The campaign requirement is removed — same
  agent-centric pattern as the promise follow-up.
- **Lever B (re-contact suppression) retained for the pending window.** A promise's
  `dueDate`, a callback time, or an optional new-terms grace sets
  `CampaignAccountState.suppressUntil` so automated campaign dispatch doesn't pester the
  account before the promise is due. `CALLBACK` only feeds Lever B; it is not a tracked
  entity.

## Capabilities

### New Capabilities

- `payment-promises`: the `PaymentPromise` entity and its `PENDING → MET | EXPIRED |
CANCELLED` lifecycle (with DUE derived); auto-expiry when an account leaves its
  portfolio; and the operator worklist actions (mark paid, follow up via ad-hoc agent
  dispatch, view expired).

### Modified Capabilities

- `account-contact-log`: `outcome` becomes the single structured record on every gestión;
  the generic `Objective` entity and its scenarios are **removed**; payment-promise
  creation is scoped to payment outcomes only; Lever B (`suppressUntil`) is generalized to
  be fed by payment-promise `dueDate`, callback time, and optional new-terms grace; a
  campaign-less follow-up gestión (`campaignId = null`, `agentTemplateId` set) links back to
  its originating promise.
- `web-console`: the "Objectives" dashboard section becomes a "Payment Promises" worklist
  with DUE signaling and operator actions (mark paid, follow up via agent picker, view
  expired); the gestión detail view shows `outcome` + an optional linked payment promise
  instead of generic linked objectives; **manual outreach** ("Contactar manualmente") is
  reframed to select an agent template (no campaign).
- `ai-insights`: references to creating/not-modifying `Objective` records are restated in
  terms of `PaymentPromise` (analysis fills AI fields only; it does not create or modify
  payment promises or alter the outcome).

## Impact

- **`mods/common`**: `Outcome` enum (incl. `DELIVERED`/`NOT_DELIVERED`/`NEW_TERMS`/
  `DISPUTE_RAISED`/`INFORMATION_REQUEST`), `PaymentPromise` schema/types. Removal of
  `Objective` types.
- **`mods/apiserver`**: `paymentPromise` procedures (list/KPIs, mark paid, cancel, follow
  up via agent dispatch), auto-expiry hook on portfolio removal, updated gestión hot-path
  (`suppressUntil`, `recoveredAmount`, promise creation), campaign-less follow-up gestión
  write. Removal of `Objective` procedures/records; data migration for existing `Objective`
  rows. No background sweep job.
- **`mods/webapp`**: Payment Promises worklist (DUE signaling, mark-paid, follow-up with
  agent-template picker, expired view), gestión detail page reshape, new i18n strings;
  removal of the generic Objectives UI.
- **Pencil**: dashboard "Payment Promises" worklist and detail page designs (handled in the
  ship Pencil stage).

## Out of Scope (future changes)

- **Outbound webhook** for non-payment outcomes (NEW_TERMS, DISPUTE, etc.) and promise
notifications — deferred to its own change now that nothing here depends on it.
<!-- (Manual-outreach agent-based rework is now in scope — see "What Changes".) -->
