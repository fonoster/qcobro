## Context

Today every outreach dispatch failure — a rejected WhatsApp template, an expired Meta access
token, a Twilio timeout, a Fonoster outage — is caught once by the channel-specific try/catch in
`dispatchOutreach.ts` and rewrapped as a plain `Error` via `providerDispatchError`. The engine's
`errorClass` (`rawErr.constructor.name`) therefore always resolves to the literal string
`"Error"`. `reserveAttempt.ts` increments `CampaignAccountState.attemptCount`/`attemptsToday` and
`PortfolioAccount.totalAttempts` before the provider call runs, and never rolls the increment back
on failure. There is no campaign-level reaction to a run of failures: `campaignStatus` is only
`PAUSED | ACTIVE | COMPLETED | ARCHIVED`, and only an operator (or the end-date check) ever
changes it. The net effect: a systemic outage on one channel is indistinguishable, in every
persisted signal, from a campaign that has genuinely exhausted its reachable accounts.

This is a cross-cutting change: it touches the shared dispatch layer used by both the campaign
engine and manual outreach, the attempt-budget bookkeeping, the campaign entity's status model,
the engine-events schema, and the webapp's campaign views.

## Goals / Non-Goals

**Goals:**

- Give every dispatch failure a real classification (`DELIVERY_REJECTED` vs `SYSTEM_ERROR`) at
  the point where the provider client knows the difference.
- Stop a run of system errors from consuming an account's attempt budget.
- Give a campaign a way to stop itself, automatically, when its dispatches are all system-error
  failures — using the existing `PAUSED` status rather than inventing a new one.
- Tell the operator, in the console, why a campaign is paused.

**Non-Goals:**

- No new durable record of individual failed dispatch attempts. Structured logging via the
  existing engine-events flight recorder is sufficient; this change does not add a
  `ContactOutcome`-like row (or any other persisted table) for failed dispatches.
- No general delivery-status ingestion project (e.g. wiring up SMS status callbacks) — only the
  classification needed at throw-time to distinguish delivery vs. system failures.
- No change to manual (non-campaign) outreach's error handling beyond it also receiving
  `DispatchError` instead of a bare `Error`; manual outreach still has no attempt-cap concept to
  interact with.
- No toast/notification-center system — this repo has none, and adding one is out of scope.

## Decisions

### `DispatchError` shape and classification boundary

`DispatchError extends Error` with a `kind: "DELIVERY_REJECTED" | "SYSTEM_ERROR"` field, thrown by
the provider clients themselves (`metaWhatsAppClient.ts`, the SMS/voice/email clients), not
guessed at by `dispatchOutreach.ts`. Only the client talking to a given provider's API knows how
to read that provider's error shape (e.g. Meta's `error.code`/`error.type`, an HTTP status, a
Twilio error code). `providerDispatchError` in `dispatchOutreach.ts` is replaced with a thin
pass-through that preserves the `DispatchError` if one was thrown, and only falls back to wrapping
as `SYSTEM_ERROR` for a truly unclassified throw (e.g. a bug, a network layer error the client
didn't itself catch) — never `DELIVERY_REJECTED` by default, since an unclassified error should
not silently exempt a system outage from consuming attempt budget in the wrong direction is not
possible here: defaulting unclassified to `SYSTEM_ERROR` is the safe default because it's the one
that does _not_ charge attempt budget, so an unrecognized failure mode fails toward "don't
penalize the account," not toward "silently miscount a real contact attempt."

Per-provider mapping (illustrative, finalized during implementation):

- Meta WhatsApp: 4xx template/recipient rejection (bad number, template not approved, opted out)
  → `DELIVERY_REJECTED`; 5xx, timeout, auth (401/403 from an expired/invalid token), network
  error → `SYSTEM_ERROR`.
- Twilio SMS: an error code indicating an undeliverable/invalid number → `DELIVERY_REJECTED`;
  timeout, 5xx, auth failure → `SYSTEM_ERROR`.
- Fonoster voice: call setup rejected by the carrier/invalid destination → `DELIVERY_REJECTED`;
  API/auth/network failure → `SYSTEM_ERROR`.
- Email (Resend): a hard bounce/rejection at send time → `DELIVERY_REJECTED`; API/auth/network
  failure → `SYSTEM_ERROR`.

**Alternative considered**: classify centrally in `dispatchOutreach.ts` by inspecting whatever
error each client throws. Rejected — it would require `dispatchOutreach` to know every provider's
error shape, defeating the point of injected, provider-specific clients, and would drift as
provider APIs change.

### Attempt-budget: don't charge, don't reserve-and-rollback

`reserveAttempt.ts` is changed to only increment `attemptCount`/`attemptsToday`/`totalAttempts`
once the dispatch outcome is known to be a delivered send or a `DELIVERY_REJECTED` failure — not
before the dispatch call, and not for `SYSTEM_ERROR`.

**Alternative considered**: keep reserving before dispatch (as today) and roll back the increment
if the outcome turns out to be `SYSTEM_ERROR`. Rejected: this repo's engine already treats
attempts as at-most-once per tick specifically to avoid races (see the tick's single-flight guard
and the cross-instance Postgres advisory lock in `runner.ts`); adding a rollback path reintroduces
a window where a concurrent read of `CampaignAccountState` could observe the reserved-then-rolled-
back count, and gains nothing over deferring the increment to after the outcome is known, since
`reserveAndDispatch` already awaits the dispatch call in the same code path before returning.

### Circuit breaker reuses `PAUSED`, no new status

The engine tracks consecutive `SYSTEM_ERROR` dispatch failures per campaign (in-memory per tick
sequence is sufficient — it does not need to survive a process restart, since a restart naturally
gives the campaign a fresh chance). A configured threshold
(`engine.consecutiveSystemErrorPauseThreshold` in `qcobro.json`, alongside the engine's other
tunables) trips the breaker: the campaign is transitioned to `PAUSED` with
`pauseReason: "AUTO_ERROR_THRESHOLD"`, and a `campaign.autopaused` event is recorded with the
triggering error kind and the consecutive count. The counter resets on any dispatch that is
either a success or a `DELIVERY_REJECTED` failure (either means the channel is actually reachable
right now — the problem was that specific recipient, not the system).

Reusing `PAUSED` rather than adding a `FAILED` status avoids a status-enum/schema migration and
reuses `PAUSED`'s already-specified semantics (invisible to the engine, no dispatch, all data and
progress retained). Reactivation stays a deliberate, manual `PAUSED → ACTIVE` operator action —
the same transition operators already use — so nothing auto-resumes a campaign that just
auto-paused for a real reason.

**Alternative considered**: add a `FAILED` status distinct from `PAUSED`. Rejected — per
`campaigns` spec, `PAUSED` already means "not visible to the engine, no dispatch, everything
retained," which is exactly what's needed; a distinct `FAILED` status would need its own entry in
`campaignStatusTransitions` and its own UI treatment for no behavioral gain over `PAUSED` +
`pauseReason`.

### `pauseReason` and its UI surface

`Campaign.pauseReason: "MANUAL" | "AUTO_ERROR_THRESHOLD" | null` (null/absent when not paused).
Set to `"MANUAL"` by the existing operator-driven `updateCampaignStatus` path when transitioning
to `PAUSED`, set to `"AUTO_ERROR_THRESHOLD"` by the circuit breaker, and cleared whenever the
campaign leaves `PAUSED` (to `ACTIVE` or `ARCHIVED`).

The webapp has no toast/notification-center component (confirmed: no toast library, no bell/
notification-center in `mods/webapp`). The existing precedent for "the system paused something
automatically, tell the operator why" is `BillingPausedBanner.tsx`, an `Alert`-based banner shown
for `credits_exhausted`/`payment_failed`. This change adds an analogous banner on
`CampaignDetail.tsx`, shown only when `pauseReason === "AUTO_ERROR_THRESHOLD"`, plus a short
reason line under the status badge in the `Campaigns.tsx` list rows (same gating). The status
badge itself is unchanged — still the existing orange `PAUSED` pill — since the transition and
its meaning (`no dispatch, nothing lost`) are identical regardless of _why_ it's paused; only the
explanatory copy differs. All copy goes through i18n keys per this repo's convention.

## Risks / Trade-offs

- **[Risk]** A borderline provider error gets misclassified (e.g. a transient 5xx that's really a
  permanent rejection, or vice versa) → **Mitigation**: bias the default/unclassified case toward
  `SYSTEM_ERROR` (doesn't charge budget) rather than `DELIVERY_REJECTED` (does), since the worse
  outcome is silently burning a real contact's budget on a false negative, not being slightly
  slower to trip the circuit breaker.
- **[Risk]** The consecutive-error counter is in-memory and resets on process restart → the
  breaker could fail to trip across a restart mid-outage → **Mitigation**: acceptable — a restart
  is infrequent, and the attempt-budget fix (not charging `SYSTEM_ERROR`) is the primary
  protection against account-level harm; the circuit breaker is a secondary safeguard against
  campaign-level wasted cycles, not account-level harm.
- **[Risk]** `DispatchError.kind` is a breaking change to the shape callers of `dispatchOutreach`
  and the provider clients see → **Mitigation**: this is an internal contract (no external SDK
  consumers of `dispatchOutreach` itself); the manual-outreach tRPC route and the engine are the
  only two callers and both are updated in this same change (see tasks.md).
- **[Trade-off]** Reusing `PAUSED` means an operator glancing at the badge alone can't tell a
  manual pause from an auto-pause — only the detail-view banner and list reason line do. Accepted
  because it avoids a status-model migration for a distinction that only matters as an
  explanation, not as different dispatch behavior.

## Migration Plan

1. Add `Campaign.pauseReason` via Prisma migration (nullable, defaults to null; backfill not
   needed since no campaign is currently auto-paused).
2. Land `DispatchError`/`kind` in `@qcobro/common`, then update each provider client to throw it,
   then `dispatchOutreach.ts`'s fallback wrapping — in that order so each layer compiles against
   the new type before the next depends on it.
3. Update `reserveAttempt.ts` and the engine's `reserveAndDispatch` to defer the increment.
4. Add the circuit breaker counter and auto-pause trigger to the engine tick.
5. Add the `campaign.autopaused` event to `engine-events` schema and emit it.
6. Webapp: banner + list reason line + i18n keys.
   No rollback concerns beyond a standard revert — the `pauseReason` column is additive and nullable.

## Open Questions

- Exact default value for `engine.consecutiveSystemErrorPauseThreshold` — proposed default TBD
  during implementation (e.g. 10), informed by realistic outage lengths vs. false-positive risk
  for a campaign that's simply small (few candidates per tick).
