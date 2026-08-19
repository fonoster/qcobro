## 1. Configuration

- [x] 1.1 `twilio.webhookBaseUrl?: string` added to `twilioConfigSchema` (`mods/common/src/config.ts`), mirroring `fonoster.webhookBaseUrl`; documented in `config/qcobro.example.json`

## 2. Dispatch — register the status callback

- [x] 2.1 `TwilioSmsClient.sendMessage()` passes `statusCallback: \`${webhookBaseUrl}/api/sms/events\``when`webhookBaseUrl`is configured; omitted otherwise (no behavior change when unconfigured). URL-building pulled into a pure`buildSmsStatusCallbackUrl` for direct unit testing without mocking the Twilio SDK client
- [x] 2.2 No changes needed to `SmsClient`, `dispatchOutreach.ts`, `engine.ts`, or `outreach.ts` — confirmed; the webhook correlates by `providerRef` alone

## 3. Webhook endpoint

- [x] 3.1 `mods/apiserver/src/rest/smsEvents.ts` — `POST /api/sms/events` handler
- [x] 3.2 Signature validation via `twilio.validateRequest` against the configured `authToken`
      and the exact configured callback URL; rejects (403) before touching any data
- [x] 3.3 Status → outcome mapping: `delivered` → `DELIVERED`, `undelivered`/`failed` →
      `NOT_DELIVERED`, everything else → update `channelData.deliveryStatus` only
- [x] 3.4 Finalizer function `recordSmsDeliveryStatus.ts` (mirrors `recordVoiceAiCallStatus.ts`'s
      pattern): idempotent guard — only finalize while outcome is still `OTHER`; every callback
      updates `channelData.deliveryStatus` regardless
- [x] 3.5 Unknown `MessageSid` (no matching gestión) → 200, logged, no write
- [x] 3.6 Wired in `mods/apiserver/src/index.ts` — mounted only when `twilio.webhookBaseUrl` is
      configured, route-scoped `express.urlencoded()` (Twilio posts form-encoded, not JSON)

## 4. Tests

- [x] 4.1 Unit: `delivered` finalizes `DELIVERED`, `channelData.deliveryStatus` set
- [x] 4.2 Unit: `undelivered`/`failed` finalizes `NOT_DELIVERED`, `channelData.deliveryStatus` set
- [x] 4.3 Unit: interim statuses (`queued`/`sending`/`sent`) update `channelData.deliveryStatus`,
      never finalize
- [x] 4.4 Unit: idempotency — a callback after finalization never changes the outcome
- [x] 4.5 Unit: unknown `MessageSid` → no-op, no throw
- [x] 4.6 Unit: signature validation rejects a missing signature, an invalid signature, and a
      signature computed for a different callback URL — none reach the finalizer
- [x] 4.7 Unit: `buildSmsStatusCallbackUrl` includes the callback URL only when
      `webhookBaseUrl` is configured, strips a trailing slash
- [ ] 4.8 **Live dev-stack verification required before merge** (per standing practice for
      external-integration-heavy changes): dispatch a real SMS against the live stack with a
      real publicly reachable `webhookBaseUrl`, confirm Twilio's callback round-trips,
      signature validates against the real `authToken`, and the gestión finalizes correctly
- [x] 4.9 Green on touched packages: common build + tests (169), apiserver typecheck + tests
      (334, incl. 15 new), webapp typecheck

## 5. Spec sync & archive (gated)

- [x] 5.1 `openspec validate sms-delivery-status --strict` passes
- [ ] 5.2 Sync deltas into main specs (gate first — after live verification, task 4.8)
- [ ] 5.3 Archive the change (gate first)
