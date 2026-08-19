## Why

SMS gestións are permanently stuck at the dispatch-time `OTHER` placeholder — not a stuck
subset, all of them, unconditionally. `TwilioSmsClient.sendMessage()` only confirms Twilio
_accepted_ the message for sending (`messages.create()` resolving); nothing in the codebase
ever checks whether the handset actually received it. There is no status webhook, no polling,
no finalizer of any kind for SMS after dispatch.

The spec already anticipated this: `account-contact-log/spec.md` documents a
`channelData.deliveryStatus` field for SMS (and, same gap, for Email and WhatsApp) that is
never populated in code. `SMS is fire-and-forget and SHALL only produce DELIVERED or
NOT_DELIVERED` is already the documented contract — this change is what actually makes it true.

Twilio's mechanism is well-suited to close this cleanly: `messages.create()` accepts a
`statusCallback` URL and pushes every status transition to it in real time
(`queued → sent → delivered`, or `undelivered`/`failed`), and the Twilio SDK ships proper
webhook signature validation (`validateExpressRequest`, using the account's `authToken`) — so,
unlike the voice work, this can be authenticated from day one rather than shipped with a known
gap. A webhook is the natural fit here, not a poller: the constraint that pushed the voice fix
toward CDR-polling (Fonoster's `DialStatus` structurally cannot report a normal call ending)
does not apply to Twilio's delivery-status model.

## What Changes

- **SMS dispatch registers a Twilio `statusCallback`** pointing at
  `<webhookBaseUrl>/api/sms/events` whenever `twilio.webhookBaseUrl` is configured (a new
  config field, mirroring `fonoster.webhookBaseUrl`). Absent → no callback registered, SMS
  stays exactly as fire-and-forget as it is today (non-breaking default).
- **A new `POST /api/sms/events` endpoint**, authenticated via Twilio's own request-signature
  validation (`X-Twilio-Signature` against the configured `authToken`) — not an unauthenticated
  gap to fix later, unlike the precedent this repo already has in `voiceEvents.ts`.
- **Terminal statuses finalize the gestión**: Twilio's `delivered` → `DELIVERED`;
  `undelivered`/`failed` → `NOT_DELIVERED` (existing binary contract, no new outcome values).
  Interim statuses (`queued`/`sending`/`sent`/...) update `channelData.deliveryStatus` for
  visibility but do not finalize — matching the conservative "never guess" posture from the
  voice work. Idempotent per message: once finalized, later callbacks (Twilio may retry
  delivery of the webhook itself) never overwrite the outcome.
- **Dispatch-path-agnostic by construction.** Unlike the voice fix (which needed care to cover
  both the campaigns engine and manual/ad-hoc outreach separately), this webhook correlates
  purely by `messageSid`/`providerRef` against the gestión table — it doesn't matter which
  dispatch path originated the send, so there's no equivalent coverage gap to design around.

## Capabilities

### New Capabilities

- `sms-events-hook`: Twilio status-callback registration (mirrors `voice-events-hook`'s shape)
  and the `POST /api/sms/events` endpoint — signature validation, status → outcome mapping,
  idempotent finalization.

### Modified Capabilities

- `account-contact-log`: documents how the already-specified SMS `DELIVERED`/`NOT_DELIVERED`
  contract is actually fulfilled, and that `channelData.deliveryStatus` is populated as Twilio
  status callbacks arrive.

## Impact

- Affected specs: `account-contact-log` (modified), `sms-events-hook` (new)
- Affected code: `mods/common/src/config.ts` (`twilio.webhookBaseUrl`),
  `mods/apiserver/src/services/twilioSmsClient.ts` (pass `statusCallback`), a new
  `mods/apiserver/src/rest/smsEvents.ts` handler + finalizer function, `mods/apiserver/src/index.ts`
  (route wiring)
- No changes to `engine.ts`, `outreach.ts`, or `dispatchOutreach.ts` — see "Dispatch-path-agnostic
  by construction" above
