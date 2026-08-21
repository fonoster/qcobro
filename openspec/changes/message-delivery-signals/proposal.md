## Why

`EMAIL` and `WHATSAPP` are the only channels with no delivery signal, so a gestión on either
one leaves `DISPATCHED` **only when the customer replies**. Every delivered-but-unanswered
message — the overwhelming majority — sits at `DISPATCHED` forever, and the workspace contact
rate (which counts `entrega: DELIVERED`) reports near-0% for an email-only portfolio no matter
how many messages actually landed (#103).

The data to fix this is already arriving and being discarded. Meta's webhook delivers a
`statuses` array carrying `sent`/`delivered`/`read` that `whatsAppWebhook.ts` inspects only for
opt-out error 131050. Resend emits `email.delivered`/`email.bounced`/`email.opened` that nothing
subscribes to, and `dispatchOutreach` throws away the Resend message id that would correlate
them. The console is likewise pre-built and starved: `caminoPath()` renders a `Leído` stage from
`channelData.openedAt`, a field no code in the repository has ever written.

## What Changes

- **The existing `POST /api/email/inbound` webhook now ingests Resend's outbound events too**,
  routed on the event name: `email.received` keeps the reply path, everything else takes the
  new delivery path. One endpoint, one signing secret, **no new configuration key** — enabling
  this on a deployment means ticking more event boxes on the Resend webhook it already has.
  - `email.delivered` → `entrega: DELIVERED`
  - `email.bounced` → `entrega: FAILED` with `deliveryReason` derived from Resend's
    `bounce.type`/`bounce.subType`
  - `email.failed` → `entrega: FAILED` with `PROVIDER_ERROR`
  - `email.opened` → `channelData.openedAt` (display-only; no axis moves)
  - `email.complained` → `entrega: DELIVERED` (a complaint proves the message landed) plus
    `resultado: OPT_OUT`, matching what the WhatsApp 131050 path already does
  - `email.sent` / `email.delivery_delayed` → `channelData.deliveryStatus` visibility only
- **Email dispatch persists the Resend message id.** `dispatchOutreach` currently discards the
  `{ id }` its `EmailClient` returns; the id becomes the correlation key for the events above.
  `providerRef` cannot carry it — it is already the reply-to token that inbound replies
  correlate on — so a new indexed `AccountContactLog.providerMessageId` column holds it.
- **WhatsApp delivery statuses are ingested** rather than dropped. The existing `statuses` loop
  in `whatsAppWebhook.ts` grows from an opt-out-only filter into a full status handler:
  `delivered` → `entrega: DELIVERED`, `read` → `channelData.openedAt`, `failed` → `entrega:
FAILED` with `deliveryReason` from Meta's error code. The 131050 opt-out behavior is
  preserved exactly, now expressed as `FAILED`/`REJECTED` **and** `resultado: OPT_OUT`.
- **`Leído` becomes reachable** in the Gestión detail's `Camino` progression on both threaded
  channels. This is a data fix, not a UI change — `contactAxes.ts` already renders the stage.

No behavior changes for `SMS`, `VOICE_AI`, or `VOICE_PRERECORDED`.

## Capabilities

### New Capabilities

- `email-events-hook`: authenticated ingestion of Resend outbound email events
  (delivered/bounced/failed/opened/complained), correlated to a gestión by Resend message id,
  advancing `entrega` and recording read receipts. The email-side sibling of `sms-events-hook`
  and `voice-events-hook`.

### Modified Capabilities

- `whatsapp-channel`: the inbound webhook requirement extends from "opt-out suppression" to
  ingesting the full `statuses` array — delivery, read receipts, and failure reasons — with the
  existing 131050 opt-out behavior preserved.
- `email-channel`: outbound dispatch SHALL persist the Resend message id on the gestión, and
  the Resend configuration keeps a single webhook signing secret rather than gaining a second.

`account-contact-log` is deliberately **not** in this list. The `channelData` inventory it
carries for Email is being rewritten by the in-flight `contact-log-axes` change, which is
code-merged but not yet spec-synced; editing the same requirement from two pending deltas would
conflict. This change updates that delta's inventory line directly instead (see tasks 6.1–6.2).

## Impact

**Schema** — `AccountContactLog.providerMessageId String? @unique` (nullable; existing rows keep
`null`). Additive, no backfill, no downtime.

**Config** — none. Delivery events ride the existing endpoint and its existing
`inboundSigningSecret`. **BREAKING (hardening):** that secret now _must_ be set — the webhook
previously skipped signature verification when it was absent, which left an endpoint that
mutates gestiones open to anyone. It now rejects with 401 and logs the reason at startup.

**Code**

- `mods/common/src/config.ts` — `resendConfigSchema`
- `mods/common/src/schemas/contactLog.ts` — `providerMessageId` on the create input
- `mods/apiserver/prisma/schema.prisma` + migration
- `mods/apiserver/src/functions/email/recordEmailDeliveryStatus.ts` (new, validated function)
- `mods/apiserver/src/functions/whatsApp/recordWhatsAppDeliveryStatus.ts` (new, validated function)
- `mods/apiserver/src/rest/emailWebhook.ts` (renamed from `emailInbound.ts`, now serving both
  directions) + `svixSignature.ts` (extracted from it)
- `mods/apiserver/src/rest/whatsAppWebhook.ts` — statuses loop delegates to the new function
- `mods/apiserver/src/functions/outreach/dispatchOutreach.ts` — capture and return the Resend id
- `mods/apiserver/src/engine/engine.ts` — pass it through to `recordDispatch`
- `mods/apiserver/src/index.ts` — register the route

**External setup** — subscribe the **existing** Resend webhook to the outbound `email.*` events
in addition to `email.received`, and (for opens) enable Resend's open tracking on the domain.
No new endpoint and no new secret.

**Not affected** — billing. Message meters bill `perMessage` at send time; every signal in this
change is reporting-only and never re-bills.
