## Why

`PaymentPromise` is QCobro's only tracked outcome, and `payment-promises/spec.md` defines its
creation as channel-agnostic (any gestión outcome that implies a payment commitment). Email
and WhatsApp already honor this: each inbound reply runs the channel's autopilot `decide()`
step, which can produce a `PAYMENT_PROMISE` outcome + objective that feeds `PaymentPromise`
creation. Voz IA never does — `POST /api/voice/events`' `conversation.ended` handler only
writes transcript, recording, duration, and settles billing. A debtor can promise to pay on a
live AI call and QCobro records nothing but the transcript; the promise is invisible to the
operator worklist unless someone reads the transcript by hand. This is a first-class-feature
gap, not an intentional channel exclusion — worth closing before Voz IA volume grows.

## What Changes

- Add a Voz IA autopilot decision step, structurally reusing the existing decision contract
  (`EmailAutopilotDecision`/`emailAutopilotDecisionSchema` in `@qcobro/common` — `outcome` +
  `objective { amount, dueDate, note }`), minus `replyBody` (a call that already ended has
  nothing left to send a reply into).
- Unlike Email/WhatsApp, which decide **per inbound reply** (mid-conversation, QCobro owns
  each turn), Voz IA decides **once**, on `conversation.ended`, over the full final
  transcript — QCobro does not own the live turns of an autopilot-run call; it only observes
  start/end events.
- Wire the decision's `outcome`/`objective` into the existing `recordOutcome` path (the same
  one `ingestEmailReply`/`ingestWhatsAppMessage` call), so `PaymentPromise` creation,
  idempotency (`@@unique([contactLogId])`), and the global `intentStatus` side effect are
  reused as-is — no new persistence logic.
- Decision runs after the transcript is attached to the gestión, alongside (not instead of)
  the existing insight generation on `conversation.ended`; a decision failure must not affect
  event ingestion (same best-effort-after-response posture the insight generator already
  has).

## Capabilities

### New Capabilities

(none — this extends an existing capability rather than introducing a new one)

### Modified Capabilities

- `voice-events-hook`: `conversation.ended` gains a decision step that derives `outcome` +
  `objective` from the final transcript and records them through `recordOutcome`, in addition
  to its existing transcript/recording/billing-settlement behavior.

## Impact

- `mods/apiserver/src/services/` — new voice decision service (mirrors `emailAutopilot.ts` /
  `whatsAppAutopilot.ts`; same provider dispatch shape, transcript-based prompt instead of a
  thread-based one).
- `mods/apiserver/src/rest/voiceEvents.ts` — invoke the decision step on `conversation.ended`
  after the transcript is persisted, and call `recordOutcome` with the result.
- `mods/apiserver/src/functions/voice/ingestVoiceEvent.ts` — likely unchanged (stays focused
  on correlation + transcript/recording persistence); decision runs alongside it from the
  REST handler, matching how insight generation is already wired.
- No `@qcobro/common` schema changes expected — reuses `emailAutopilotDecisionSchema` as-is.
- No new Prisma models — reuses `PaymentPromise`/`recordOutcome` unchanged.
