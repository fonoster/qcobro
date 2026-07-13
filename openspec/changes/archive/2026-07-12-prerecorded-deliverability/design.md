## Context

Pre-recorded voice is billed as a voice meter (`voicePrerecorded`: perMinute + increments) but the
current specs classify it as fire-and-forget alongside SMS and give it no way to produce an
answered duration — or even a real delivered/not-delivered result. The UI also labels it
"Reproducido" (played), a claim we cannot substantiate. Meanwhile QCobro already runs the
pre-recorded VoiceServer **co-located with the apiserver** (same container/process), so the answer
and hangup are directly observable in-process.

Voz IA solved the analogous problem with an HTTP events-hook (`/api/voice/events`) because the
Fonoster autopilot is a remote service. Pre-recorded does not need that surface — the completion
is local. This change makes pre-recorded honest (delivered = answered, duration is the real
signal), wires its settlement through the existing voice estimate→settle machinery, and adds a
cross-channel lifecycle stepper to the gestión detail. It also corrects a latent spec bug where
email/WhatsApp were mislabeled "one-way".

## Goals / Non-Goals

**Goals:**

- Reclassify `VOICE_PRERECORDED` as Observed: `DELIVERED` (answered) / `NOT_DELIVERED`, with
  `durationSeconds`.
- Settle pre-recorded usage in-process on completion, reusing the voice estimate→settle path;
  idempotent per call ref; unanswered → net zero.
- Gestión detail shows outcome + duration, keeps the replayable script separate, and never implies
  the message was heard.
- Add an arrow-driven lifecycle stepper as the primary "what happened" visual across channels.
- Fix the "one-way channels" detail requirement so email/WhatsApp render their thread.

**Non-Goals:**

- No HTTP callback endpoint for pre-recorded completion.
- No change to SMS delivery-status ingestion (SMS left as-is; separate future work).
- No "completion ratio" report UI now — only the optional `scriptDurationSeconds` capture that
  makes it possible later.
- No change to the `voicePrerecorded` pricing model or the increment formula.

## Decisions

**In-process completion, not a webhook.** The co-located VoiceServer settles usage and
writes/updates the gestión inline when the call ends. Rationale: the process boundary Voz IA has to
cross (remote autopilot) does not exist here; adding an HTTP route would be an unsecured,
unnecessary surface. Alternative considered — mirror `/api/voice/events` for symmetry — rejected as
over-engineering plus an auth liability.

**Delivered = answered, drop "Reproducido".** We cannot prove playback (TTS on the leg ≠ heard;
mid-message hangup still "plays"). The answered duration is the honest proxy and already exists as a
byproduct of billing. Alternative — keep a playback-confirmed flag — rejected: it asserts something
we cannot verify and complicates the VoiceServer contract.

**Reuse the existing voice settlement function.** Pre-recorded and Voz IA share the estimate→settle
accounting; only the completion trigger differs. This keeps one billing code path (`usage-ledger`).

**Lifecycle stepper as a shared component.** One `LifecycleStepper` renders channel-specific stage
lists (arrows, active/muted), driven by the gestión's outcome + channelData, replacing bespoke
per-channel status labels. Built Storybook-first.

**Label = "Entregado" (unified with SMS).** Chosen over "Contestada" for cross-channel consistency;
the enum stays `DELIVERED`/`NOT_DELIVERED` regardless, so this is display-only and cheap to revisit.

## Risks / Trade-offs

- [Duplicate completion double-settles] → idempotency keyed on call ref, mirroring the Voz IA
  settlement guarantee; asserted by a unit test.
- ["Entregado" reads as "message heard" to operators] → detail copy and the stepper deliberately
  avoid "escuchó/heard"; surface the duration so a 0:02 answer is self-evidently a hangup.
- [Stepper stages drift from real channel states] → stages are derived from the gestión outcome +
  channelData, not hardcoded per row; each channel's stage list lives in one place.
- [MODIFIED spec blocks lose detail at archive] → full requirement blocks were reproduced, not
  partials.

## Migration Plan

- Additive schema: `durationSeconds` already exists; `channelData.scriptDurationSeconds?` is
  optional. No data migration for existing gestiones (older pre-recorded rows simply lack duration).
- Ship spec + apiserver/VoiceServer completion handling + webapp detail together; the stepper
  degrades gracefully for rows without full lifecycle data (unreached stages muted).
- Rollback is code-only; no destructive DB change.

## Open Questions

- Should the optional `scriptDurationSeconds` be populated in this change or deferred until the
  completion-ratio report is actually built? (Leaning: capture it now — cheap, avoids a backfill.)
