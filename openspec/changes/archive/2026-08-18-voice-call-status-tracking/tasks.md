## 1. Shared call-status tracking capability

**Design correction during build (see design.md):** the first version consumed Fonoster's live
`Calls.TrackCall` dial-progress stream (`DialStatus`) as the primary signal, falling back to the
CDR only for the answered-but-unconfirmed case. Dropped after checking Fonoster's own
`createTrackCall.ts`: that stream is never closed for a call that answers and later hangs up
normally — `DialStatus` has no value for "the call ended" at all, only for whether the dial
attempt connected. Replaced with a CDR-only design: poll `Calls.GetCall` with backoff from the
start, no live stream, no upfront delay, one source of truth for every outcome.

- [x] 1.1 `FonosterOutboundCallClient.getCallDetail(ref)` — CDR lookup via `SDK.Calls.getCall`,
      the sole tracking signal (`Calls.TrackCall`/`trackCall()` removed entirely, along with the
      deep-imported `TrackCallRequest` construction it required)
- [x] 1.2 `resolveVoiceCallFromCdr` — polls `getCallDetail` with backoff starting immediately
      (no upfront delay: an in-progress call simply returns nothing); maps `NORMAL_CLEARING` →
      `DELIVERED` with the CDR's real duration, anything else → the channel's not-delivered
      equivalent with zero duration; gives up (leaves the gestión as-is) if the poll budget
      (~2.5 min default) is exhausted before the CDR appears
- [x] 1.3 Shared finalizers applying the idempotency guard (only finalize while outcome is
      still the dispatch-time `OTHER` placeholder): `recordPrerecordedOutcome` (existing, reused
      as-is) for `VOICE_PRERECORDED` → `NOT_DELIVERED`/`DELIVERED`; new
      `recordVoiceAiCallStatus` for `VOICE_AI` → `NO_ANSWER`/`DELIVERED`
- [x] 1.4 `startVoiceCallStatusTracking` — the one entry point every dispatch site calls,
      fire-and-forget; failures logged + swallowed, never affect the call or the caller

## 2. Dispatch-site wiring — every voice dispatch, both channels

**Second design correction:** the first version also started `VOICE_PRERECORDED` tracking from
inside `voiceServer.ts` using `req.callRef`, coupling coverage to the call actually being routed
to that external app. A call failing before ever reaching it would stay uncovered. Moved to the
dispatch site instead, which also surfaced a third gap: manual/ad-hoc outreach (`outreach.ts`)
is a structurally separate dispatch path from the campaigns engine and had no tracking wiring at
all in the first version.

- [x] 2.1 `engine.ts`: `startVoiceCallStatusTracking` called for both `VOICE_PRERECORDED` and
      `VOICE_AI` right after the dispatch-time `OTHER` gestión is written, fire-and-forget
      (does not add latency to the dispatch loop)
- [x] 2.2 `outreach.ts` (manual/ad-hoc dispatch): same call, same place — right after its own
      `OTHER` gestión write. `ctx.voiceCallStatusTracker` added to the tRPC context, same
      `FonosterOutboundCallClient` instance as `ctx.outboundCallClient`
- [x] 2.3 `voiceServer.ts` reverted to only the answer/say/hangup completion flow — no tracking
      coupling; its `onCompleted` path is unchanged and still wins when it resolves first
      (idempotency guard, reusing `recordPrerecordedOutcome` unchanged)
- [x] 2.4 CDR shows a non-normal-clearing status → finalizes `NOT_DELIVERED` (prerecorded) /
      `NO_ANSWER` (Voz IA) immediately once available, from either dispatch site
- [x] 2.5 CDR shows `NORMAL_CLEARING` and the channel's normal completion never fired →
      finalizes `DELIVERED` with the CDR's real duration, from either dispatch site
- [x] 2.6 Billing settlement: tracking-driven finalization is a completion path in its own
      right (started at dispatch, not merely a fallback something else already settles for),
      so both dispatch sites wrap their finalizer with the same `settleVoiceUsageTx`-backed
      settlement the VoiceServer/autopilot-webhook paths already perform
      (`withVoiceUsageSettlement` in `engine.ts` / `outreach.ts`), gated on billing enabled;
      settlement itself is idempotent (`settledAt`)

## 3. index.ts wiring

- [x] 3.1 `FonosterOutboundCallClient` instances reused across ports at each construction site
      (`engine/start.ts`: `outboundCallClient` + `voiceCallStatusTracker`; `trpc/context.ts`:
      same for manual dispatch) — one authenticated Fonoster client/login per site, not two
- [x] 3.2 `index.ts`'s VoiceServer wiring is unchanged from before this change (no tracking
      wiring lives there — see 2.3)

## 4. Tests

- [x] 4.1 Unit: CDR available immediately, `NORMAL_CLEARING` → `DELIVERED` with real duration,
      no wasted poll
- [x] 4.2 Unit: CDR available immediately, non-normal-clearing → not-delivered equivalent with
      zero duration, never fabricated
- [x] 4.3 Unit: call still in progress (CDR not yet written) → keeps polling, finalizes once it
      appears
- [x] 4.4 Unit: poll budget exhausted → gives up, gestión left unfinalized
- [x] 4.5 Unit: idempotency — a gestión already finalized by the normal path (including a
      conversational VOICE_AI outcome like `PAYMENT_PROMISE`) is never overwritten by a
      later CDR resolution
- [x] 4.6 **Live verification** — merged as PR #90 and confirmed working in production
- [x] 4.7 Green on touched packages: common build + tests (169), apiserver typecheck + tests
      (328), webapp typecheck

## 5. Spec sync & archive (gated)

- [x] 5.1 `openspec validate voice-call-status-tracking --strict` passes
- [x] 5.2 Synced into main specs (`account-contact-log`)
- [x] 5.3 Archive the change
