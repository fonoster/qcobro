## 1. Shared types (`@qcobro/common`)

- [x] 1.1 Add `DispatchError` (class or discriminated error shape) with `kind: "DELIVERY_REJECTED" | "SYSTEM_ERROR"` to `mods/common/src/types` (alongside the existing `DispatchResult`/`DispatchChannel` types).
- [x] 1.2 Add `pauseReason` (`"MANUAL" | "AUTO_ERROR_THRESHOLD"`, nullable) to the `Campaign` schema in `mods/common/src/schemas/campaigns.ts`.
- [x] 1.3 Add `campaign.autopaused` to the engine event schema in `mods/common/src/schemas/engineEvents.ts`, and change the `dispatch.failed` event's `errorClass` field type/docs to the `DispatchError.kind` union instead of a free-form string.
- [x] 1.4 Add `engine.consecutiveSystemErrorPauseThreshold` to the engine config schema consumed from `qcobro.json`.

## 2. Provider clients classify failures at the source

- [x] 2.1 Update `mods/apiserver/src/services/metaWhatsAppClient.ts`'s `sendTemplate`/`sendText` to throw `DispatchError` with `kind: DELIVERY_REJECTED` for Meta API rejections (invalid recipient, unapproved/rejected template) and `kind: SYSTEM_ERROR` for network/timeout/5xx/auth failures.
- [x] 2.2 Update the SMS client (Twilio) to classify undeliverable/invalid-number errors as `DELIVERY_REJECTED` and transport/auth/timeout errors as `SYSTEM_ERROR`.
- [x] 2.3 Update the voice client (Fonoster `OutboundCallClient`) to classify carrier/invalid-destination rejections as `DELIVERY_REJECTED` and API/auth/network failures as `SYSTEM_ERROR`.
- [x] 2.4 Update the email client (Resend) to classify hard bounces/rejections as `DELIVERY_REJECTED` and API/auth/network failures as `SYSTEM_ERROR`.
- [x] 2.5 Ensure every provider client falls back to `SYSTEM_ERROR` (never `DELIVERY_REJECTED`) for any error it cannot classify.

## 3. Dispatch layer

- [x] 3.1 Replace `providerDispatchError` in `mods/apiserver/src/functions/outreach/dispatchOutreach.ts` with pass-through logic: rethrow an already-classified `DispatchError` as-is, and wrap any other unclassified throw as `DispatchError` with `kind: SYSTEM_ERROR`.
- [x] 3.2 Update the "channel not configured" / "integration missing" failure paths (voice, SMS, WhatsApp) to throw `DispatchError` with `kind: SYSTEM_ERROR`.
- [x] 3.3 Update unit tests for `dispatchOutreach.ts` and each provider client to assert the new `DispatchError`/`kind` contract.

## 4. Attempt budget

- [x] 4.1 Update `mods/apiserver/src/functions/campaigns/reserveAttempt.ts` so `attemptCount`, `attemptsToday`, and `totalAttempts` are only incremented once the dispatch outcome is known to be a success or `DispatchError` with `kind: DELIVERY_REJECTED`.
- [x] 4.2 Update `mods/apiserver/src/engine/engine.ts`'s `reserveAndDispatch` to sequence the reservation after the dispatch call resolves (or otherwise ensure a `SYSTEM_ERROR` outcome never reaches `reserveAttempt`'s increment path).
- [x] 4.3 Update/add tests confirming a `SYSTEM_ERROR` dispatch failure leaves `CampaignAccountState` and `PortfolioAccount.totalAttempts` unchanged, while a `DELIVERY_REJECTED` failure still increments them.

## 5. Circuit breaker

- [x] 5.1 Add per-campaign consecutive-`SYSTEM_ERROR` tracking to the engine tick (`mods/apiserver/src/engine/engine.ts` / `funnel.ts`), reset on any success or `DELIVERY_REJECTED` outcome.
- [x] 5.2 Trip the breaker at `engine.consecutiveSystemErrorPauseThreshold`: transition the campaign to `PAUSED` with `pauseReason: AUTO_ERROR_THRESHOLD` via the existing status-update path (`updateCampaignStatus.ts` or the engine's direct DB call, per how `completeCampaign` already writes status).
- [x] 5.3 Emit a `campaign.autopaused` engine event on trip, carrying the triggering error kind and consecutive count.
- [x] 5.4 Set `pauseReason: MANUAL` on the existing operator-driven `updateCampaignStatus.ts` transition into `PAUSED`, and clear `pauseReason` whenever a campaign leaves `PAUSED`.
- [x] 5.5 Add engine tests: sustained `SYSTEM_ERROR` trips the breaker at the threshold; a success or `DELIVERY_REJECTED` resets the counter; an auto-paused campaign stays paused until manually reactivated.

## 6. Data model

- [x] 6.1 Add a Prisma migration for `Campaign.pauseReason` (nullable enum or string, default null).

## 7. Webapp

- [ ] 7.1 Add an `Alert`-based banner to `mods/webapp/src/pages/CampaignDetail.tsx`, shown when `pauseReason === "AUTO_ERROR_THRESHOLD"`, following the pattern in `mods/webapp/src/components/BillingPausedBanner.tsx`.
- [ ] 7.2 Add a short reason line under the status badge in `mods/webapp/src/pages/Campaigns.tsx` list rows, gated the same way.
- [ ] 7.3 Add the new i18n keys (banner copy, list reason line) via `mods/webapp/src/lib/i18n.tsx` — no hardcoded strings.

## 8. Verification

- [ ] 8.1 Run the apiserver unit test suite (dispatch, reserveAttempt, engine, engine-events).
- [ ] 8.2 Manually exercise a simulated WhatsApp system-error run (e.g. an invalid access token) against a test campaign and confirm: attempt counters don't move, the campaign auto-pauses at the configured threshold, a `campaign.autopaused` event is recorded, and the console banner/list reason appear.
