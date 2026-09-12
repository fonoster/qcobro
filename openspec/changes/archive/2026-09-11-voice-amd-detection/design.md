## Context

Fonoster's PR #893 ("answering machine detection via Asterisk `AMD()`") adds
Asterisk-native AMD to outbound calls. It runs in the dialplan before `Stasis()`,
**always continues into the calling application regardless of its own verdict** — it
never hangs up a call itself — and leaves the result in `AMDSTATUS`/`AMDCAUSE`. The
Node side surfaces this as `VoiceRequest.amd = { status: HUMAN|MACHINE|UNKNOWN,
confidence, detector, latencyMs }` on the live call, and as `amdStatus`/`amdCause` on
the call's CDR. It's off by default (`APISERVER_AMD_ENABLED`, a Fonoster deployment env,
not a per-call parameter QCobro sets), only evaluated on outbound (`TO_PSTN`) calls, adds
up to ~4s of dead air before the app is dispatched, and — because `app_amd` is a
deterministic heuristic, not a model — `confidence` is always `0` or `1`, never a
tunable probability. It reports `MACHINE` only; it cannot distinguish a voicemail
greeting from an IVR menu.

QCobro has two independent voice channels and, crucially, two independent ways a Voz IA
gestión gets finalized:

- **`VOICE_PRERECORDED`**: QCobro's own co-located `VoiceServer` gets the live
  `VoiceRequest` per call and drives the whole interaction (`voiceServer.ts`) — it can
  act on `req.amd` directly, in real time.
- **`VOICE_AI` (Autopilot), live path**: Fonoster's own hosted autopilot runs the
  conversation and posts `conversation.ended` back to QCobro
  (`decideVoiceOutcome.ts`). This path **never sees `req.amd`** — that's internal to
  Fonoster's autopilot process — and nothing yet exposes the verdict to the autopilot's
  own decision loop, so it cannot react to AMD at all today.
- **`VOICE_AI`/`VOICE_PRERECORDED`, sweep path**: `voiceCompletionTimeoutSweep.ts`
  finalizes gestións that never got a live completion signal, by reading Fonoster's CDR
  (`Calls.getCall`). This is the **only** place `amdStatus` is available to QCobro at
  all right now, and it only runs for calls that got stuck at `DISPATCHED`.

`account-contact-log` already reserves a `Path` value for this (`VOICEMAIL`), added
ahead of need with a comment that it's unreachable until AMD exists (issue #83).

## Goals / Non-Goals

**Goals:**

- Rename `VOICEMAIL` → `ANSWERED_BY_MACHINE` in the `Path` enum, collapsing the
  voicemail/IVR distinction QCobro's detector can't make anyway.
- Let a pre-recorded campaign hang up instead of playing its message when AMD reports
  `MACHINE`, per-template, default on.
- Label `path: ANSWERED_BY_MACHINE` from the CDR's `amdStatus` wherever QCobro can
  actually observe it today — the sweep path, for both channels.
- Leave a clear, spec-documented trail for the follow-up: making Voz IA's live
  conversation path react to AMD in real time needs Fonoster to expose the signal to the
  autopilot's own decision loop, which does not exist yet.

**Non-Goals:**

- Making the Autopilot itself hang up, skip the greeting, or otherwise change its
  behavior when AMD fires — that's a Fonoster-side capability that doesn't exist, and is
  out of scope here (tracked as a new, separate issue).
- Tuning AMD's own detection thresholds (`amd.conf` lives in Fonoster's Asterisk image,
  not QCobro) or adding retry-suppression policy for machine-answered numbers — the
  existing `UNREACHABLE`/retry-eligibility semantics are reused unchanged.
- Adding a colored badge/icon system for `path` values — none exists today (path
  renders as plain text); out of scope per the "small visual changes" framing agreed
  with the user.
- Distinguishing voicemail from IVR — the detector can't, so QCobro doesn't try to
  either.

## Decisions

**1. Rename, don't add, the enum value.** `VOICEMAIL` is renamed in place to
`ANSWERED_BY_MACHINE` rather than adding a new value alongside it. Nothing in QCobro
writes `VOICEMAIL` today (confirmed by grep across `mods/`), so this is a schema-only
change: a hand-written `ALTER TYPE "Path" RENAME VALUE` (the repo's established pattern
for enum/column renames — see `20260907120000_contact_log_axes_english_names` — instead
of letting Prisma diff it as drop+recreate).

**2. Pre-recorded hang-up reuses the existing `UNREACHABLE` delivery/deliveryReason
pairing, adding only `path`.** A machine-detected hang-up is, functionally, "answered
but the script did not play" — exactly what `delivery: FAILED` /
`deliveryReason: UNREACHABLE` already means in `prerecorded-audio`. Rather than invent a
new `deliveryReason`, this reuses that pairing and adds `path: ANSWERED_BY_MACHINE` as
the new signal that distinguishes "we chose not to play it" from "the script failed to
play." This keeps retry eligibility (`UNREACHABLE` is transient) unchanged rather than
silently making retry policy for machine-answered numbers — that's a deliberate,
separate policy decision this change doesn't make.

**3. The toggle rides the same `metadata` string-bag the DTMF fields already use.**
`VoicePrerecordedConfig.hangupOnMachineDetected` flows DB → dispatch params → Fonoster
call `metadata` → `voiceServer.ts`, identical in shape to `repeatDigit` et al. No new
plumbing mechanism, no DB lookup added to `voiceServer.ts` (it has none today and
shouldn't gain one for this).

**4. AMD labeling for Voz IA is wired into the sweep only, not the live path.** The two
paths are genuinely disjoint (see Context). Reaching into `decideVoiceOutcome.ts`'s
`decidePath()` would require giving the live webhook path a new CDR-lookup dependency it
doesn't have today, purely to chase coverage that Fonoster's own AMD doesn't actually
enable yet (since AMD never stops the call from reaching the autopilot). Wiring only the
sweep path is the honest scope: it labels exactly the calls where QCobro can actually
observe the verdict, and the spec says so explicitly rather than implying full coverage.

**5. `confidence` is not surfaced as a threshold/config knob anywhere in QCobro.**
Upstream, it's `0`/`1` (a heuristic decision, not a probability) — there is nothing to
tune on the QCobro side. If Fonoster's earlier in-process ONNX approach (PR #889) ever
supersedes the Asterisk detector, `confidence` becoming a real probability is an
upstream contract change QCobro would pick up for free through the same `req.amd`/
`amdStatus` fields; no QCobro-side change is anticipated for that.

## Risks / Trade-offs

- **[Risk] Upstream contract isn't published yet** → the dependency bump and any actual
  runtime verification are blocked until a Fonoster release ships PR #893.
  **Mitigation**: spec/design/schema/plumbing work proceeds now against the documented
  contract; the build stage re-checks npm before bumping and pauses if still missing.
- **[Risk] Partial Voz IA coverage may read as "done" when it isn't** → only calls that
  never reach `conversation.ended` get labeled. **Mitigation**: the spec's new scenario
  says this explicitly, and the proposal opens a separate, clearly-scoped follow-up issue
  for the live-path gap rather than leaving it implicit.
- **[Risk] AMD adds ~4s of dead air per pre-recorded call when enabled** → this is
  upstream, deliberate, and off by default; QCobro doesn't control it, only whether to
  act on the result. No mitigation needed beyond leaving it off until a workspace
  explicitly wants it (an ops/deployment decision, not part of this change).
- **[Risk] Reusing `UNREACHABLE` conflates "machine answered" with "genuine playback
  failure" in aggregate delivery-failure counts** → mitigated by `path:
ANSWERED_BY_MACHINE` being the distinguishing signal for anyone drilling in; accepted
  as reasonable for v1 rather than adding a new deliveryReason for a single new case.

## Migration Plan

1. Schema/migration: `ALTER TYPE "Path" RENAME VALUE 'VOICEMAIL' TO
'ANSWERED_BY_MACHINE'`; `ALTER TABLE "voice_prerecorded_configs" ADD COLUMN
"hangupOnMachineDetected" BOOLEAN NOT NULL DEFAULT true` (single-statement, fixed
   default for all rows — no backfill, per the `20260911120000_sms_normalize_gsm7`
   precedent).
2. `mods/common` schema/type changes, then `mods/apiserver` read/write sites, then
   `mods/webapp` (i18n rename + new checkbox).
3. Dependency bump (`@fonoster/voice`/`@fonoster/sdk`) — gated on an actual Fonoster
   release; ships dark either way, since `APISERVER_AMD_ENABLED` is off by default
   upstream.
4. No rollback complexity beyond a normal revert: the enum rename has no live data to
   lose (confirmed), and the new column defaults `true` with a fixed value.

## Open Questions

- None blocking the spec/design work. The one real open dependency (Fonoster release
  timing) is tracked as a build-stage gate, not a design ambiguity.
