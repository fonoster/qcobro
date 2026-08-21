## Context

`contact-log-axes` (merged as f480826, spec-unsynced) replaced the flat `ContactOutcome` enum
with three independent axes. `entrega` — did it reach the device or inbox — became the source of
truth for contactability, replacing a numerator of `lastContactedAt IS NOT NULL` that was set on
every attempt whether or not it landed. That was the right correction, but it exposed which
channels can actually observe delivery:

| Channel             | Delivery signal today                       | `entrega` leaves `DISPATCHED`? |
| ------------------- | ------------------------------------------- | ------------------------------ |
| `SMS`               | Twilio status callback → `/api/sms/events`  | Yes                            |
| `VOICE_AI`          | Fonoster events-hook → `/api/voice/events`  | Yes                            |
| `VOICE_PRERECORDED` | In-process VoiceServer call-status tracking | Yes                            |
| `EMAIL`             | **none** — only an inbound reply            | Only if the customer replies   |
| `WHATSAPP`          | **none** — only an inbound reply            | Only if the customer replies   |

The old metric was over-optimistic (~100%); the new one is over-pessimistic (~0% on an
email-only portfolio). Neither is right, and the gap is confined to the two rows above.

Two pieces of the fix are already built and idle:

- `whatsAppWebhook.ts:243` iterates Meta's `statuses` array — which carries `sent`, `delivered`,
  and `read` — and `continue`s on everything that is not error 131050.
- `contactAxes.ts:82` renders a `Leído` stage in the `Camino` progression from
  `channelData.openedAt`. A repo-wide grep for `openedAt` returns readers and spec prose only;
  no code has ever written it. The i18n keys exist in both languages.

`recordSmsDeliveryStatus.ts` is the established shape for "provider callback advances `entrega`
on one gestión, idempotently" and both new functions follow it closely.

## Goals / Non-Goals

**Goals:**

- `EMAIL` and `WHATSAPP` gestiones reach `DELIVERED` (or `FAILED` with an actionable reason)
  without requiring a customer reply, so the contact-rate KPI means the same thing on all five
  channels.
- Read receipts populate `channelData.openedAt`, making the already-built `Leído` stage render.
- Reuse the existing provider-callback shape rather than inventing a third one.

**Non-Goals:**

- **Per-channel contact rate** (option 3 in #103). It reports around the gap instead of closing
  it; once both channels have real signals there is nothing left to segment for this reason.
- **Do Not Contact enforcement.** `resultado: OPT_OUT` stays a findable marker in the console,
  exactly as the WhatsApp 131050 path already treats it, until #101 builds the DNC list.
- **`camino` from a read receipt.** Read-but-unengaged is deliberately unmodelled: `openedAt` is
  display-only and enters no metric. This preserves the `contact-log-axes` decision.
- **Re-billing on delivery.** Message meters bill `perMessage` at send; these signals are
  reporting-only.
- **Click tracking** (`email.clicked`). No consumer, and it carries the same tracking-pixel
  reliability problems as opens with less value.

## Decisions

### 1. A new indexed `providerMessageId` column, not `providerRef`, not a JSON lookup

Resend's outbound `email.*` events correlate on `data.email_id`, the id returned by the send
call. `providerRef` cannot hold it: for `EMAIL` it is already the reply-to token
(`dispatchOutreach.ts:74`), which is what inbound replies correlate on and what makes the
dispatch-time upsert idempotent. Both keys must coexist.

_Alternative considered:_ store the id in `channelData.messageId` (which is what the
`account-contact-log` spec's field inventory already nominally says) and query it with Prisma's
JSON path filter. Rejected — `channelData` has no index, so every delivery callback would seq-scan
a table that grows one row per outreach attempt forever.

_Alternative considered:_ echo our own token back via Resend `tags` or a custom header, avoiding
the schema change. Rejected — `data.email_id` is present on every Resend email event and
documented; `tags`/`headers` presence in outbound event payloads is version-dependent, and
betting webhook correlation on an uncertain payload field is how signals get silently dropped.

The spec's Email `channelData` inventory is corrected to `{ deliveryStatus, openedAt? }` rather
than storing the message id twice.

### 2. One endpoint carrying both directions, not a second route

`emailInbound.ts` already had the exact branch point, spending it on a discard:

```ts
// Ignore non-reply events (e.g. delivery notifications for outbound emails).
```

That early return becomes the delivery path, routed on the event name rather than the
recipient so the existing reply detection is untouched and an absent `type` still falls through
to it. The file is renamed `emailWebhook.ts`, matching `whatsAppWebhook.ts`, which already
serves this same dual role for its provider.

_Alternative considered, and initially built:_ a separate `/api/email/events` route with its own
`resend.eventsSigningSecret`, matching the `/api/sms/events` and `/api/voice/events` naming.
Rejected on operational cost. Resend issues a signing secret per endpoint, so the split bought a
second dashboard registration, a second config key, and a deploy step for every environment — in
exchange for naming symmetry with two channels whose providers _force_ separate callbacks
(Twilio registers a status callback per message; this is one webhook either way). Consolidating
makes enabling this capability a matter of ticking more event checkboxes on a webhook that
already exists, with no configuration change at all.

The URL keeps saying `inbound` because that names the direction of the _webhook_ — everything
Resend sends us is inbound — and because it is the URL already registered in production.

The Svix verification helper moves out into `rest/svixSignature.ts`.

**Fail closed.** The endpoint previously skipped verification entirely when
`inboundSigningSecret` was unset. That was already wrong — the reply path writes `entrega`,
`camino` and an autopilot `resultado` — and the delivery path widens it, so the missing secret
now rejects with 401 and logs once at startup instead of trusting every caller.

### 3. `entrega` only ever advances — enforced in the function, not the caller

Both new functions read the gestión's current `entrega` and finalize only when it is still
`DISPATCHED`, mirroring `recordSmsDeliveryStatus`. This matters more here than for SMS because
these channels have two independent writers racing: a customer can reply (`ingestEmailReply`
sets `DELIVERED`) before, after, or between the provider's `delivered` and `opened` events, and
Resend and Meta both retry webhook delivery. Non-terminal statuses always update
`channelData.deliveryStatus` for operator visibility regardless.

`channelData.openedAt` is likewise written once — the first open wins — so it records when the
message was first read rather than when it was last re-opened by an image proxy.

### 4. Failure-reason mappings live in one table per provider, defaulting to `PROVIDER_ERROR`

Following the `TWILIO_ERROR_CODE_REASON` precedent: map only the codes with a genuinely
different retry policy, and bucket everything else into `PROVIDER_ERROR` — actionable, but
carrying no retry assumption.

Resend bounces branch on `bounce.type`/`bounce.subType`: `Permanent`/`NoEmail` and
`Permanent`/`General` are `INVALID_DESTINATION`, `Permanent`/`Suppressed` is `REJECTED`, and any
`Transient` bounce (`MailboxFull`, `General`) is `UNREACHABLE` — transient, worth retrying.

Meta status errors: `131026` (undeliverable / not a WhatsApp user) is `INVALID_DESTINATION`;
`131047` (outside the re-engagement window), `131048`/`131049` (spam and per-user quality
limits), and `131050` (user opted out) are `REJECTED` — the number is valid, the message was
blocked.

### 5. The 131050 opt-out becomes two axis writes, not a replacement

Today that path writes `resultado: OPT_OUT` and nothing else. Under the three-axis model a
platform block is _also_ a delivery failure, so it now writes `entrega: FAILED` +
`deliveryReason: REJECTED` **and** keeps `resultado: OPT_OUT`. The axes are independent by
design — `account-contact-log` states explicitly that a `FAILED` delivery may still carry a
`resultado` — so this composes rather than conflicts, and it stops opt-outs from being invisible
to the contactability KPI.

## Risks / Trade-offs

- **Email opens are an unreliable signal.** Apple Mail Privacy Protection and corporate image
  proxies pre-fetch the pixel (false opens); blocked images suppress it (missed opens). →
  Contained by construction: `openedAt` is display-only, feeds no metric, and moves no axis.
  This is exactly why `contact-log-axes` refused to model read-but-unengaged as a `camino` value,
  and this change does not revisit that.

- **`email.delivered` means "accepted by the receiving server," not "in the inbox."** A message
  can be delivered and then filed as spam. → `DELIVERED` already carries this caveat on other
  channels (pre-recorded `DELIVERED` means the call was answered, not that anyone listened) and
  the spec states the limit explicitly rather than overclaiming.

- **Contact rate will jump sharply on the first deploy** for email-heavy workspaces — from near
  0% to something realistic. An operator watching the KPI will see a discontinuity with no
  change in their own behavior. → Only new gestiones get signals; historical rows keep
  `providerMessageId: null` and stay `DISPATCHED`. Called out in the release notes rather than
  backfilled, since the delivery data for past sends is not recoverable from either provider.

- **A missing `eventsSigningSecret` accepts unverified posts.** → Same posture as
  `inboundSigningSecret` today, so this introduces no new asymmetry, but the deploy checklist
  (task 7.3) makes configuring it explicit. Worth noting the endpoint only ever advances
  `entrega` on a gestión whose Resend message id an attacker would have to already know.

- **Depends on the unsynced `contact-log-axes` deltas.** Its `entrega`/`camino`/`resultado`
  model is merged in code but still absent from `openspec/specs/`. → This change's deltas are
  written against new capability surfaces and against `whatsapp-channel`/`email-channel`
  requirements that exist in main specs today, touching no requirement the pending delta also
  edits. The one line it does need from that delta — the Email `channelData` inventory — is
  amended in place there (tasks 6.1–6.2) so the two land consistently in either sync order.

## Migration Plan

1. Additive migration: `ALTER TABLE account_contact_logs ADD COLUMN provider_message_id TEXT`
   plus a unique index. Nullable, no backfill, safe to run ahead of the code deploy.
2. Deploy the apiserver. Until the Resend dashboard endpoint exists, `/api/email/events` simply
   receives nothing; WhatsApp statuses start being ingested immediately on the existing webhook.
3. Add the Resend webhook endpoint pointed at `<webhookBaseUrl>/api/email/events`, subscribed to
   `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`,
   `email.complained`, `email.opened`. Copy its signing secret into `resend.eventsSigningSecret`
   and restart.
4. Enable open tracking on the Resend domain (opens only; clicks stay off).

**Rollback:** unregister the Resend endpoint and revert the apiserver. The column can stay —
it is nullable and nothing reads it when the code is gone.
