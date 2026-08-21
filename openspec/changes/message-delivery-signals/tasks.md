## 1. Contracts and schema

- [x] 1.1 Add `eventsSigningSecret: z.string().min(1).optional()` to `resendConfigSchema` in
      `mods/common/src/config.ts`, and extend the block's doc comment to name both endpoints and
      say the secrets are per-endpoint and independent
- [x] 1.2 Add `providerMessageId: z.string().min(1).optional()` to `createContactLogFields` in
      `mods/common/src/schemas/contactLog.ts`, documented as the second correlation key
      (outbound provider events) versus `providerRef` (inbound replies)
- [x] 1.3 Add `providerMessageId String? @unique` to `AccountContactLog` in
      `mods/apiserver/prisma/schema.prisma`, with a comment explaining why `providerRef` cannot
      carry it for EMAIL
- [x] 1.4 Generate the migration and confirm it is purely additive (add column + unique index,
      no backfill, no NOT NULL)
- [x] 1.5 Add `eventsSigningSecret` to `config/qcobro.example.json` and to the prod-shaped
      example, so the deploy step is discoverable from the repo

## 2. Email delivery-status ingestion

- [x] 2.1 Extract `verifySvixSignature` from `mods/apiserver/src/rest/emailInbound.ts` into
      `mods/apiserver/src/rest/svixSignature.ts` and re-point `emailInbound.ts` at it; no
      behavior change, existing inbound tests must stay green untouched
- [x] 2.2 Create `mods/apiserver/src/functions/email/recordEmailDeliveryStatus.ts` as a
      validated function following `functions/sms/recordSmsDeliveryStatus.ts`: correlate by
      `providerMessageId` + `agentType: "EMAIL"`, return `{ matched: false }` on no match
- [x] 2.3 Implement the event → axis mapping: `email.delivered` and `email.complained` →
      `DELIVERED`; `email.bounced` → `FAILED` with the `bounce.type`/`bounce.subType` reason
      table; `email.failed` → `FAILED`/`PROVIDER_ERROR`; `email.sent` and
      `email.delivery_delayed` → `channelData.deliveryStatus` only
- [x] 2.4 Implement `channelData.openedAt` from `email.opened`, written only when absent so the
      first open wins; assert in the code comment that it moves no axis
- [x] 2.5 Implement `resultado: OPT_OUT` on `email.complained`, and guard `entrega` so it
      finalizes only from `DISPATCHED` (advance-only, matching `recordSmsDeliveryStatus`)
- [x] 2.6 Create `mods/apiserver/src/rest/emailEvents.ts`: 503 when `resend` is absent, 401 on
      failed Svix verification when `eventsSigningSecret` is set, 200 otherwise (including
      unmatched), `provider.event` recorded either way
- [x] 2.7 Register `POST /api/email/events` in `mods/apiserver/src/index.ts` next to the inbound
      route, with a comment pointing at the separate Resend endpoint + secret

## 3. Email dispatch carries the message id

- [x] 3.1 Capture the `{ id }` returned by `emailClient.sendEmail` in
      `mods/apiserver/src/functions/outreach/dispatchOutreach.ts` and return it as
      `providerMessageId` on the EMAIL dispatch result
- [x] 3.2 Widen the dispatch result type in `mods/common/src/types/dispatch.ts` with an optional
      `providerMessageId`, left unset by the other four channels
- [x] 3.3 Pass it through to `recordDispatch` in `mods/apiserver/src/engine/engine.ts`
- [x] 3.4 Verify the manual/ad-hoc outreach path also carries it (same `dispatchOutreach`
      result), or record why it does not apply

## 4. WhatsApp delivery-status ingestion

- [x] 4.1 Create `mods/apiserver/src/functions/whatsApp/recordWhatsAppDeliveryStatus.ts` as a
      validated function: correlate by `providerRef` + `agentType: "WHATSAPP"`, map
      `delivered`/`read`/`failed`/`sent`, and carry the Meta error-code reason table
- [x] 4.2 Preserve the 131050 opt-out behavior exactly, now as `FAILED` + `REJECTED` **and**
      `resultado: OPT_OUT`; keep the existing comment about #101 and the DNC list
- [x] 4.3 Replace the opt-out-only `statuses` loop in
      `mods/apiserver/src/rest/whatsAppWebhook.ts` with a call to the new function, keeping the
      existing `recordEvent` flight-recorder call and its `summary` shape
- [x] 4.4 Confirm the inbound-message loop and quality-rating path are untouched

## 5. Tests

- [x] 5.1 `recordEmailDeliveryStatus.test.ts` — one case per event type, the bounce reason
      table (permanent/suppressed/transient/unknown), first-open-wins, advance-only from a
      `FAILED` and from a reply-set `DELIVERED`, and the unmatched case
- [x] 5.2 `recordWhatsAppDeliveryStatus.test.ts` — `delivered`, `read`, `sent`, `failed` per
      mapped error code, the 131050 dual write, advance-only, and the unmatched case
- [x] 5.3 `emailEvents.test.ts` — 503 unconfigured, 401 bad signature, 200 valid, 200 unmatched,
      and that a valid signature over the raw body passes (mirror `emailInbound.test.ts` setup)
- [x] 5.4 Extend `whatsAppWebhook.test.ts` for the statuses path, asserting the opt-out case
      still behaves as before plus the new `entrega`
- [x] 5.5 Extend `dispatchOutreach` tests to assert the Resend id is returned and reaches
      `recordDispatch`
- [x] 5.6 E2E: extend `e2e/contact-log-axes.spec.ts` (or add `e2e/message-delivery.spec.ts`) to
      seed a delivered-and-opened EMAIL gestión and assert the detail renders
      `Despachado → Leído → Respondió` and the list shows `Entregado`
      — **written as `e2e/message-delivery.spec.ts`, not yet run**: it needs the dev stack up,
      which was not running in this session. Run it before merging.
- [x] 5.7 Run `npm run lint`, `npm run build`, and the apiserver + webapp unit suites clean

## 6. Spec reconciliation

- [x] 6.1 Update the Email `channelData` line in
      `openspec/changes/contact-log-axes/specs/account-contact-log/spec.md` from
      `{ messageId, deliveryStatus, openedAt? }` to `{ deliveryStatus, openedAt? }`, noting the
      message id now lives in the indexed `providerMessageId` column
- [x] 6.2 Add `providerMessageId` to that delta's field inventory alongside `providerRef`, with
      the one-line reason both exist
- [x] 6.3 Update `DELIVERABILITY.md` §3: EMAIL and WHATSAPP now have real delivery signals;
      strike the open items that this change closes and note that the `Sent → Delivered → Opened
→ Replied` lifecycle it promised is now actually implemented

## 7. Verification and deploy

- [ ] 7.1 Run the real dev stack against live Resend: send one email, confirm the gestión moves
      `DISPATCHED → DELIVERED`, open it and confirm `Leído` renders in the Camino progression
- [ ] 7.2 Send to a known-bad address and confirm the bounce lands as `FAILED` with
      `INVALID_DESTINATION` rather than the `PROVIDER_ERROR` fallback
- [ ] 7.3 Register the Resend webhook endpoint at `<webhookBaseUrl>/api/email/events` subscribed
      to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`,
      `email.failed`, `email.complained`, `email.opened`; copy its signing secret into the
      deployed `qcobro.json` as `resend.eventsSigningSecret`
- [ ] 7.4 Enable open tracking on the Resend sending domain (opens only, not clicks)
- [ ] 7.5 Note in the release notes that workspace contact rate will step up on first deploy for
      email-heavy workspaces, and that historical gestiones stay `DISPATCHED` because neither
      provider can replay delivery data for past sends
