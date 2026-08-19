## Context

Both voice channels write a dispatch-time placeholder outcome of `OTHER` on the gestión, from
**two independent dispatch paths** — the campaigns engine tick (`engine.ts`) and manual/ad-hoc
outreach (`trpc/routers/outreach.ts`, a separate implementation, not a caller of the engine).
Today the only things that ever replace that placeholder are:

- `VOICE_PRERECORDED`: the embedded VoiceServer's `onCompleted` callback, which only fires if
  `res.answer()` → `res.say()` → `res.hangup()` all resolve **and** the call was routed to that
  external app's handler at all. `Verb.run()` (in `@fonoster/voice`) has no timeout and no
  listener on the underlying gRPC stream ending — if Fonoster tears the call down before echoing
  back a matching verb response (the normal case for a call that was never answered), the
  awaited promise hangs forever and the handler never proceeds. And a call that fails before
  ever reaching the app (whatever the reason) never invokes the handler in the first place.
- `VOICE_AI`: the autopilot's `conversation.started`/`conversation.ended` webhook. A call that
  is never answered never starts a conversation, so this never fires — there is currently no
  completion path for an unanswered Voz IA call at all.

## Goals / Non-Goals

**Goals**

- Close the `OTHER`-forever gap for both voice channels, for every terminal call outcome, from
  **every** dispatch path (campaigns engine and manual/ad-hoc outreach alike).
- Coverage must not depend on the call ever reaching a channel-specific handler (the pre-recorded
  VoiceServer's answer/say/hangup flow, or the Voz IA autopilot webhook) — neither is guaranteed
  to be reached for every failure mode.
- Never write a fabricated `durationSeconds` — `DELIVERED` always carries a real answered
  duration, sourced from the channel's own timing when available, from the CDR when not.
- No Fonoster-side changes, no new inbound endpoint, no new auth surface.
- Idempotent: whichever signal (the channel's own normal completion vs. tracking) resolves
  first wins; the other is a no-op.
- One source of truth for tracking, not several — see "Rejected: dial-progress stream" below.

**Non-Goals**

- Not fixing the underlying `@fonoster/voice` `Verb.run()` hang itself (no timeout on the
  verb-response wait) — that's a real gap worth reporting upstream, but tracking makes it a
  non-issue for QCobro's own correctness without touching the sibling repo.
- Not building the CDR webhook explored earlier — superseded by this lower-friction approach.
- Not changing `ContactOutcome` — `NOT_DELIVERED` (prerecorded) and `NO_ANSWER` (Voz IA) are
  both already supported values.

## Decisions

### Call-status tracking is CDR-only — the live dial-progress stream was tried and dropped

An earlier version of this design consumed Fonoster's real-time `Calls.TrackCall(ref)` stream
(`DialStatus`: `TRYING`/`CANCEL`/`ANSWER`/`BUSY`/`PROGRESS`/`NOANSWER`/`FAILED`) as the primary
signal, falling back to a CDR lookup (`Calls.GetCall`) only for the answered-but-unconfirmed
case. That was dropped after checking Fonoster's own server implementation
(`mods/apiserver/src/calls/createTrackCall.ts`): the stream is only ever explicitly closed for
the three terminal _failure_ statuses (`BUSY`/`FAILED`/`NOANSWER`) — there is no `DialStatus`
value for "the call ended normally" at all, because `DialStatus` is scoped to whether the dial
attempt connected, not to the resulting call's lifecycle. A call that answers and later hangs up
normally leaves that stream open indefinitely (arguably a small resource leak on Fonoster's own
side too, since the tracking map entry is never cleared for that case either) — so it structurally
cannot report the one signal this change most needs. Requiring a live stream for that case only
bought a same-second signal for the fast terminal-failure case, at the cost of a second signal
source, a fragile deep-import of an unpublished generated-protobuf path (`TrackCallRequest`,
needed because `trackCall` isn't exposed on the public `Calls` SDK class), and a confirmed bug in
`@fonoster/sdk`'s own `dialStatusToString()` helper (maps `NOANSWER` to the string `"ERROR"`).

The CDR (`Calls.GetCall`) alone is sufficient for everything: it reflects **every** call
disposition (Fonoster's `CallStatus` — `NORMAL_CLEARING`, `USER_BUSY`, `NO_ANSWER`,
`CALL_REJECTED`, `INVALID_NUMBER_FORMAT`, ...), a strictly richer classification than
`DialStatus` ever gave (which collapsed most non-busy failures into a single `FAILED` bucket).
The CDR row is written once, at call end — a lookup before that simply returns nothing, so
polling with backoff _from the moment tracking starts_ resolves as soon as the call is actually
over, with no need to wait for or infer a "the call has ended" signal from anywhere else. This
is strictly simpler (one source of truth, one code path for every outcome, no special-casing an
in-progress signal that doesn't finalize anything) and removes the riskiest, least-verified piece
of code in the change (the deep import) in favor of the same stable, public `Calls.getCall()`
method already used elsewhere in this codebase.

### Where tracking is started: every dispatch site, not any channel-specific handler

Call-status tracking is started **once, at dispatch time**, immediately after the dispatch-time
`OTHER` placeholder gestión is written — from **both** places that write one: `engine.ts`'s
campaign-tick dispatch, and `outreach.ts`'s manual/ad-hoc dispatch. Both call the same shared
helper (`startVoiceCallStatusTracking`), for both `VOICE_PRERECORDED` and `VOICE_AI`.

This was also **not** the first design: an earlier version started `VOICE_PRERECORDED` tracking
from inside `voiceServer.ts`'s request handler, using `req.callRef`. That coupled coverage to the
call actually being routed to that external app — a call that fails before ever reaching it (for
whatever reason) would never be tracked either, reintroducing the same class of gap this change
exists to close. Starting tracking at the dispatch site instead — the one place common to every
voice call regardless of channel or dispatch path — removes that coupling entirely, and also
naturally covers manual/ad-hoc outreach, which is a structurally separate code path from the
campaigns engine and was otherwise easy to miss.

`FonosterOutboundCallClient` implements both `OutboundCallClient` (dispatch) and
`VoiceCallStatusTracker` (tracking — now just `getCallDetail`) on the same class — one instance
is reused for both at each call site (`engine/start.ts`, `trpc/context.ts`), so tracking never
needs a second authenticated Fonoster login.

### Outcome mapping (from the CDR)

| CDR `CallStatus`                                                                        | Action                                                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NORMAL_CLEARING`                                                                       | Call connected and ended normally. Finalize `DELIVERED` with the CDR's real `duration`.      |
| Anything else (`USER_BUSY`, `NO_ANSWER`, `CALL_REJECTED`, `INVALID_NUMBER_FORMAT`, ...) | Call never delivered. Finalize the channel's not-delivered equivalent, `durationSeconds: 0`. |
| _(no CDR yet — call still in progress or not yet propagated)_                           | Keep polling; not a failure.                                                                 |

### Poll schedule

`resolveVoiceCallFromCdr` polls `getCallDetail` with backoff starting immediately (no upfront
delay of any kind — there's nothing to wait for before the first check, since an in-progress
call simply returns nothing): front-loaded short (a few seconds) to catch quick failures
(busy/rejected) fast, widening for longer calls, ~2.5 minutes total by default — comfortably past
a typical Voz IA conversation. If the CDR never appears within that budget, the gestión is left
as-is rather than guessed; a later cycle (or the channel's own normal completion) may still
resolve it.

### Idempotency

Both finalization paths — a channel's own normal completion, and tracking — route through the
same guard already proven in `recordPrerecordedOutcome.ts` (reused as-is for
`VOICE_PRERECORDED`; mirrored in the new `recordVoiceAiCallStatus` for `VOICE_AI`): a completion
is only applied while the gestión's current outcome is still the dispatch-time `OTHER`
placeholder. Whichever resolves first wins; the other becomes a no-op.

### Billing settlement

Tracking-driven finalization is a completion path in its own right — not merely a fallback that
something else already settles for — so both dispatch sites wrap their finalizer with the same
`settleVoiceUsageTx`-backed settlement the VoiceServer/autopilot-webhook paths already perform
(`withVoiceUsageSettlement` in `engine.ts` / `outreach.ts`), gated on billing being enabled.
Settlement is itself idempotent (`settledAt`), so no double-settlement risk if both a channel's
normal completion and tracking somehow both attempt it.

## Risks / Trade-offs

- **Unverified against a live call.** The CDR's `CallStatus`/`duration` shape comes from the
  already-stable, public `Calls.getCall()` method (used correctly elsewhere in this codebase),
  which meaningfully de-risks this compared to the dropped dial-progress-stream approach — but
  the poll-until-found timing and the exact `NORMAL_CLEARING` classification should still be
  exercised against the real dev stack (a real dispatched call, both answered and unanswered,
  from both dispatch paths) before this change is considered mergeable, per this repo's standing
  practice for external-integration-heavy changes.
- **Tracking is fire-and-forget from a hot path** (`engine.ts`'s per-account dispatch loop) and
  a request path (`outreach.ts`'s mutation) — it is started, never awaited, and every internal
  failure is caught and logged, so it cannot add latency or fail either caller.
- **Resolution latency is bounded by the poll schedule, not instantaneous** for the terminal-
  failure case (previously near-instant via the live stream). Judged acceptable: this is a
  background correction to the outcome record, not something blocking any user-facing action,
  and the common case (a call that completes through its channel's own normal path) is
  unaffected — this only governs how quickly the _stuck_ case gets corrected.
