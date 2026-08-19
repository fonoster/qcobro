## Context

`TwilioSmsClient.sendMessage()` (`mods/apiserver/src/services/twilioSmsClient.ts`) calls
`client.messages.create({ from, to, body })` and returns `{ sid: message.sid }`. That `sid`
becomes the gestión's `providerRef` (`dispatchOutreach.ts`). Nothing else ever touches the
gestión's outcome for SMS — it is written as `OTHER` at dispatch (`engine.ts`/`outreach.ts`,
the same generic placeholder every channel gets) and never updated.

Twilio's outbound message lifecycle (`MessageStatus`, from `twilio`'s own types):
`accepted → queued → sending → sent → delivered` (success), or `→ undelivered` / `→ failed`
(failure). `messages.create()` accepts an optional `statusCallback` URL; Twilio POSTs to it
once per status transition, with `MessageSid`, `MessageStatus`, and (on failure) `ErrorCode`/
`ErrorMessage` as form-encoded body params.

Twilio's SDK (`twilio/lib/webhooks/webhooks.d.ts`) exports `validateExpressRequest` /
`getExpectedTwilioSignature`, which verify the `X-Twilio-Signature` header against the
account's `authToken` and the exact callback URL — the standard, documented way to confirm a
webhook request genuinely came from Twilio. This repo already has account-level `authToken`
for the `TwilioSmsClient` login, so no new secret is needed for this.

## Goals / Non-Goals

**Goals**

- Make the already-specified SMS `DELIVERED`/`NOT_DELIVERED` contract real.
- Authenticate the webhook from the start (verified via Twilio's own signature check) — not a
  known gap to close later.
- Idempotent: a terminal status finalizes once; later callbacks (interim or replayed) never
  change a finalized outcome.
- No coverage gap between dispatch paths — the webhook correlates by `providerRef` alone, so it
  applies uniformly regardless of which code path dispatched the message.

**Non-Goals**

- Not building a polling fallback for the case where Twilio's webhook never arrives at all
  (misconfigured `webhookBaseUrl`, sustained network failure). Twilio's status-callback
  delivery is mature, retried automatically on Twilio's side for a transient failure on ours,
  and this is a materially different reliability posture than Fonoster's `DialStatus`/`TrackCall`
  gap that made polling necessary for voice. Judged not worth the added complexity for v1; if
  operational experience says otherwise, a `messages(sid).fetch()` fallback can be added later
  without changing this design's shape.
- Not extending this to Email or WhatsApp, even though they have the identical unpopulated
  `channelData.deliveryStatus` gap — out of scope for this change; flagged for a follow-up.
- Not changing `ContactOutcome` — `DELIVERED`/`NOT_DELIVERED` are both already the full
  contract for SMS.

## Decisions

### Status → outcome mapping

| Twilio `MessageStatus`                                       | Action                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `delivered`                                                  | Terminal, success. Finalize `DELIVERED`.                                                               |
| `undelivered`, `failed`                                      | Terminal, failure. Finalize `NOT_DELIVERED`.                                                           |
| `accepted`, `queued`, `sending`, `sent`, and any other value | Not terminal. Update `channelData.deliveryStatus` with the raw status for visibility; do not finalize. |

Treating only `delivered`/`undelivered`/`failed` as terminal, and everything else as "keep
waiting," mirrors the conservative posture from the voice work: act on what Twilio has
confirmed, never infer.

### Endpoint and correlation

`POST /api/sms/events` — a single, deployment-wide endpoint (one Twilio account, matching how
`fromNumbers`/`maxSmsPerMinute` are already deployment-wide, not per-workspace). Request:

1. Verify `X-Twilio-Signature` via `validateExpressRequest(authToken, req, { url, ... })`.
   Reject with 403 on failure, matching Twilio's own documented middleware behavior — this
   endpoint is unauthenticated to nothing, unlike `voiceEvents.ts`.
2. Parse `MessageSid` + `MessageStatus` from the form-encoded body.
3. Look up the gestión by `providerRef = MessageSid`, `agentType = "SMS"` (same `findFirst`
   shape `recordPrerecordedOutcome.ts`/`recordVoiceAiCallStatus.ts` already use for their
   channels).
4. If not found: 200 anyway (Twilio doesn't need to know QCobro's internal state; avoids
   Twilio retrying a webhook that will never resolve differently), log at `warn`.
5. If found: always update `channelData.deliveryStatus` to the raw status. If the status is
   terminal per the mapping above **and** the gestión's outcome is still the dispatch-time
   `OTHER` placeholder, finalize the outcome. A terminal status arriving after the outcome has
   already left `OTHER` (replay, or a redundant `failed` after an already-processed
   `delivered` — Twilio's retry semantics on their own webhook delivery can duplicate a
   callback) is a no-op on the outcome, matching the idempotency guard already established for
   voice.

### Configuration

`twilio.webhookBaseUrl?: string` (optional, mirrors `fonoster.webhookBaseUrl`). When absent,
`TwilioSmsClient` sends without a `statusCallback` — SMS remains exactly as fire-and-forget as
it is today; no behavior regresses. When present, every `sendMessage()` call includes
`statusCallback: \`${webhookBaseUrl}/api/sms/events\``. No change to the `SmsClient` interface
or any of its callers (`dispatchOutreach.ts`, `engine.ts`, `outreach.ts`) — the webhook URL is a
deployment-wide setting baked in at `TwilioSmsClient` construction, not a per-call concern.

## Risks / Trade-offs

- **No fallback if the webhook is never reachable.** Accepted for v1 (see Non-Goals) — this is
  a real trade-off, not an oversight, and differs from the voice change's design specifically
  because Twilio's delivery reliability doesn't need one the way Fonoster's did.
- **Twilio may retry the webhook itself** on a 5xx/timeout from our side; the idempotency guard
  handles this, but the handler must return 200 promptly (parse + correlate + write, no slow
  synchronous work) so Twilio doesn't retry unnecessarily.
- **Live verification required before merge**, per this repo's standing practice for
  external-integration-heavy changes — dispatch a real SMS against the live stack and confirm
  the webhook round-trips correctly, including signature validation with the real `authToken`
  and callback URL.
