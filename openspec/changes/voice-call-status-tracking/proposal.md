## Why

Voice dispatch attempts are stuck at the dispatch-time `OTHER` placeholder far more often than
they should be, for both voice channels:

- `VOICE_PRERECORDED` was left with an explicit open gap in `prerecorded-deliverability`
  (task 3.5): the embedded VoiceServer verb handler only reports a completion when
  `res.answer()` → `res.say()` → `res.hangup()` all resolve cleanly. A call that is never
  answered — or one that _is_ answered but whose confirmation never arrives back over the
  Fonoster gRPC stream before Fonoster tears the call down — leaves the handler awaiting
  forever with no timeout, so the gestión never leaves `OTHER`. Live-log analysis of a real
  dispatch batch showed 22 of 29 pre-recorded calls stuck this way, against 7 that completed
  normally — i.e. the dashboard was correctly reporting `DELIVERED` for the calls that
  completed, but had no path at all to report `NOT_DELIVERED` for the rest.
- `VOICE_AI` has the identical, previously-unnoticed gap: the engine writes the same `OTHER`
  placeholder at dispatch (`engine.ts`), and the only thing that ever replaces it is the
  autopilot's `conversation.started`/`conversation.ended` webhook — which never fires at all
  for a call that is never answered, since no conversation ever starts.

Fonoster already has the ground truth for both cases: `Calls.GetCall(ref)` returns the call's
detail record (CDR) — Fonoster's SIP-cause-level `CallStatus` plus the real answered duration —
reachable today via `@fonoster/sdk`'s public `Calls` client with zero changes to the Fonoster
deployment. It is keyed purely by the same `ref`/`providerRef` QCobro already stores on the
gestión. (An earlier version of this design used the live `Calls.TrackCall` dial-progress
stream instead; dropped after confirming it structurally cannot report a normal call ending —
see design.md.)

## What Changes

- **`VOICE_PRERECORDED` and `VOICE_AI` gestións are finalized from Fonoster's CDR
  (`Calls.GetCall`)**, closing the `OTHER`-forever gap for both channels, started once at
  dispatch time (not from any channel-specific handler) and polled with backoff until the call's
  CDR appears — a lookup before the call has ended simply returns nothing, so there is no
  upfront delay to configure or guess. Once available: a normal call clearing finalizes
  `DELIVERED` with the CDR's real answered duration; anything else finalizes the channel's
  not-delivered equivalent (`NOT_DELIVERED` for `VOICE_PRERECORDED`, existing binary contract,
  unchanged; `NO_ANSWER` for `VOICE_AI`, already a supported outcome value — no enum change)
  with zero duration. `DELIVERED` is never recorded with a fabricated duration.
- **Coverage is independent of any channel-specific handler and of the dispatch path.** Tracking
  starts right after the dispatch-time `OTHER` placeholder is written, from both the campaigns
  engine and manual/ad-hoc outreach — not coupled to the pre-recorded VoiceServer's
  answer/say/hangup flow or the Voz IA autopilot webhook, since neither is guaranteed to be
  reached for every failure mode (see design.md for two design corrections made during build).
- **Idempotent by construction.** The existing "never downgrade a finalized outcome" rule
  (already in `recordPrerecordedOutcome`) is reused/generalized so the normal completion path
  and the tracking-based recovery path can never race each other into a wrong final state.
- **No Fonoster changes, no new webhook, no new inbound endpoint.** Everything is pulled by
  QCobro via the existing `@fonoster/sdk` gRPC client, using the same access-key auth already
  in use for call origination.

## Capabilities

### New Capabilities

<!-- None — this change closes an existing open gap and extends existing behavior. -->

### Modified Capabilities

- `account-contact-log`: `VOICE_PRERECORDED` and `VOICE_AI` gestións left at the dispatch-time
  `OTHER` placeholder are finalized from Fonoster call-status tracking when the channel's own
  completion path does not resolve; documents the terminal-status → outcome mapping and the
  answered-but-unconfirmed recovery path.

## Impact

- Affected specs: `account-contact-log`
- Affected code: `mods/apiserver/src/services/fonosterOutboundCallClient.ts` (new call-status
  tracking capability, shared with dispatch), a new `startVoiceCallStatusTracking` entry point
  called from **every** voice dispatch site — `mods/apiserver/src/engine/engine.ts` (campaign
  dispatch) and `mods/apiserver/src/trpc/routers/outreach.ts` (manual/ad-hoc dispatch) — plus
  `mods/apiserver/src/trpc/context.ts` (tracker wired into the tRPC context) and
  `mods/apiserver/src/engine/start.ts`. A new `recordVoiceAiCallStatus.ts` finalizer alongside
  the existing `recordPrerecordedOutcome.ts` (reused as-is). `voiceServer.ts` and `index.ts` are
  **unaffected** — tracking is deliberately independent of the channel-specific completion
  handlers, not layered onto them (see design.md).
- Resolves the open item left in `openspec/changes/archive/2026-07-12-prerecorded-deliverability`
  (task 3.5), plus an equivalent, previously-unnoticed gap in `VOICE_AI` and in manual/ad-hoc
  outreach for both channels.
