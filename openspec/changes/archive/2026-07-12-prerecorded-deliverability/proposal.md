## Why

Pre-recorded voice is currently classified as a "fire-and-forget" channel alongside SMS, yet
it is billed as a voice meter on **answered duration** — and nothing in the specs produces that
duration or even a real delivered/not-delivered result. The channel also over-claims in the UI
("Reproducido"/played), which we cannot prove: TTS reaching the call leg is no guarantee the
debtor heard the message, and a mid-message hangup still looks "played." Because QCobro runs the
pre-recorded VoiceServer co-located with the apiserver, it can observe answer and hangup
directly — so we can make pre-recorded honest and complete now, with no new callback surface.

## What Changes

- **Pre-recorded becomes an Observed channel, not fire-and-forget.** It still produces only
  `DELIVERED`/`NOT_DELIVERED`, but `DELIVERED` now means **the call was answered** — we drop any
  "Reproducido"/playback-confirmed claim. `durationSeconds` is populated from the co-located
  VoiceServer's answer→hangup timing.
- **Completion is handled in-process, not via an HTTP callback.** Unlike Voz IA (which posts to
  `/api/voice/events`), the co-located VoiceServer settles usage and writes/updates the gestión
  **inline** on call completion. Settlement stays idempotent per call ref and reuses the existing
  voice estimate→settle machinery (debit an estimate at dispatch; settle to the increment-billed
  amount for the answered duration; unanswered settles to net zero). The `voicePrerecorded` meter
  is unchanged.
- **Optional forward-looking capture:** the synthesized clip's **nominal length** MAY be stored
  on `channelData` so a future "completion ratio" report (answered X of a Y-second message) is
  possible without a backfill. No UI for it in this change.
- **Gestión detail (pre-recorded):** shows outcome ("Entregado") + **call duration** prominently,
  keeps the replayable TTS script visually separate from the actual call result, and uses copy
  that does **not** imply the customer heard the message.
- **Arrow-driven lifecycle stepper (new, cross-channel):** the gestión detail renders the delivery
  lifecycle as an arrow progression showing the stages the attempt moved through — e.g.
  `Sent → Delivered` (SMS, pre-recorded), `Sent → Answered → Finalizada` (Voz IA),
  `Sent → Delivered → Read → Replied` (threaded channels). Reached stages are active; unreached are
  muted. This is the primary "what happened" visual, replacing bespoke per-channel labels.
- **Detail-shape fix (bundled):** re-word the "one-way channels" detail requirement so **EMAIL and
  WHATSAPP** render their message **thread**, not "the message that was sent." True one-way is
  SMS + pre-recorded only; the real distinction the requirement encodes is "no audio player / no
  call transcript."

## Capabilities

### New Capabilities

<!-- None — this change modifies existing behavior only. -->

### Modified Capabilities

- `account-contact-log`: Move `VOICE_PRERECORDED` out of the fire-and-forget group; `DELIVERED` =
  answered (not played); require `durationSeconds` for pre-recorded; allow an optional nominal
  clip-length on `channelData`.
- `prerecorded-audio`: Add the in-process completion behavior — on call completion the co-located
  VoiceServer records answered/not + answered seconds, writes/updates the gestión, and triggers
  voice settlement; idempotent per call ref; **no HTTP endpoint**.
- `usage-ledger`: Confirm/So-state that pre-recorded voice settles via the same estimate→settle
  path (answered duration → increment-billed; unanswered → net zero).
- `web-console`: Pre-recorded detail shows outcome + duration with script kept separate and
  non-"heard" copy; add the arrow-driven lifecycle stepper; re-word the one-way grouping so
  email/WhatsApp render their thread.

## Impact

- **apiserver / VoiceServer:** in-process completion handler that measures answered duration,
  writes the pre-recorded gestión with `outcome` + `durationSeconds`, and settles usage; no new
  HTTP route. Reuses the existing voice settlement function (per `usage-ledger`).
- **@qcobro/common:** contact-log schema gains a required-for-pre-recorded `durationSeconds` and an
  optional nominal-length field on the voice `channelData` shape.
- **webapp:** gestión detail — new `LifecycleStepper` component (Storybook), pre-recorded detail
  layout (outcome + duration + separated script), and the email/WhatsApp thread rendering fix; all
  strings via the i18n layer.
- **Specs:** deltas for `account-contact-log`, `prerecorded-audio`, `usage-ledger`, `web-console`.
- **No breaking API changes**; no new external surface.
