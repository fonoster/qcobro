## Why

Outreach dispatch failures (WhatsApp, SMS, voice, email) all collapse into a single generic
`Error`, so the engine can't tell a rejected/undelivered message apart from a transient system
error (expired credentials, provider outage, network blip). Because `reserveAttempt` charges the
attempt budget before the send happens and never rolls it back, a run of pure system errors
silently exhausts an account's attempt caps exactly like real delivered attempts, and since
nothing reacts to a sustained error run, the campaign keeps running until every account has been
capped out — with nothing telling the operator why. This surfaced during WhatsApp testing: a
campaign appeared to "fail and never recover," when what actually happened is every account got
attempt-capped by unclassified errors.

## What Changes

- Provider dispatch failures are classified into a structured `DispatchError` with a `kind` of
  either `DELIVERY_REJECTED` (the provider reached the recipient side and rejected/bounced the
  message — bad number, opted out, template rejected) or `SYSTEM_ERROR` (transport/auth/outage —
  network failure, expired credentials, 5xx, timeout). **BREAKING**: `dispatchOutreach` and the
  channel clients (`metaWhatsAppClient`, SMS/voice/email clients) throw `DispatchError` instead of
  a bare `Error`; callers that pattern-match on error shape need updating.
- The engine's per-attempt `errorClass` (in `dispatch.failed` events) carries this real `kind`
  instead of always resolving to the string `"Error"`.
- `reserveAttempt` no longer charges `CampaignAccountState.attemptCount` / `attemptsToday` /
  `PortfolioAccount.totalAttempts` when a dispatch fails with `SYSTEM_ERROR` — only a delivered
  send or a `DELIVERY_REJECTED` failure consumes attempt budget, since only those mean the
  provider actually attempted to reach the recipient.
- The engine tracks consecutive `SYSTEM_ERROR` failures per campaign and, past a configured
  threshold, auto-pauses the campaign into its existing `PAUSED` status (no new status value) and
  records a `campaign.autopaused` engine event with the trigger error kind and count.
- `Campaign` gains a `pauseReason` (`MANUAL` | `AUTO_ERROR_THRESHOLD`) so the console can show
  operators _why_ a campaign is paused; reactivating a campaign clears it.
- The webapp surfaces `pauseReason` via an `Alert`-based banner on the campaign detail view
  (following the existing `BillingPausedBanner` pattern) and a short reason line under the status
  badge on the campaign list.
- Explicitly out of scope: no new durable/persisted record of individual failed dispatch attempts
  beyond what `engine-events` already logs — structured logging via the existing flight recorder
  is treated as sufficient; no new storage model is introduced.

## Capabilities

### New Capabilities

(none — this change modifies existing capabilities only)

### Modified Capabilities

- `channel-dispatch`: dispatch failures are classified as `DELIVERY_REJECTED` or `SYSTEM_ERROR`
  via a structured `DispatchError`, replacing the generic `Error` used today.
- `campaigns-engine`: attempt-budget consumption excludes `SYSTEM_ERROR` failures; a new
  consecutive-system-error circuit breaker auto-pauses a campaign past a configured threshold.
- `campaigns`: `Campaign.pauseReason` field distinguishes an operator-initiated pause from an
  automatic one triggered by the error-threshold circuit breaker.
- `engine-events`: `dispatch.failed` events carry the real error `kind` as `errorClass`; a new
  `campaign.autopaused` event records circuit-breaker trips.

## Impact

- `mods/apiserver/src/functions/outreach/dispatchOutreach.ts` — classify and rethrow
  `DispatchError` instead of `providerDispatchError`'s generic `Error`.
- `mods/apiserver/src/services/metaWhatsAppClient.ts` and the SMS/voice/email provider clients —
  classify provider-level failures at the source.
- `mods/apiserver/src/functions/campaigns/reserveAttempt.ts` — only commit attempt-count
  increments after a dispatch outcome is known, skipping `SYSTEM_ERROR` failures.
- `mods/apiserver/src/engine/engine.ts` and `mods/apiserver/src/engine/funnel.ts` — consecutive
  system-error tracking per campaign and the auto-pause trigger.
- `mods/common/src/schemas/campaigns.ts` — add `pauseReason` to the `Campaign` schema.
- `mods/common/src/schemas/engineEvents.ts` — real `errorClass` values, new
  `campaign.autopaused` event.
- Prisma schema/migration for `Campaign.pauseReason`.
- `mods/webapp` — `BillingPausedBanner`-style banner on campaign detail, reason line on the
  campaign list, new i18n keys.
