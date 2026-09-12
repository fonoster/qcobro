## Why

Fonoster's `fonoster/fonoster` PR #893 adds answering-machine detection (AMD) to
outbound calls — Asterisk's `AMD()` application, surfaced to the calling application as
`VoiceRequest.amd` (status `HUMAN`/`MACHINE`/`UNKNOWN`) and as `amdStatus`/`amdCause` on
the call's CDR. QCobro's `account-contact-log` spec already reserves a `VOICEMAIL` value
in the `Path` enum for exactly this, with a comment noting it's unreachable until AMD
exists (issue #83, filed to investigate this). Today nothing in QCobro writes it: a
pre-recorded call has no way to notice a machine picked up and always plays its script,
and Voz IA's outcome step always records `path: ENGAGED`. This wastes calls leaving a
message meant for a human on a machine, and misreports call outcomes for reporting
purposes.

**Note:** as of this proposal, PR #893 is merged into `fonoster/fonoster`'s `main` but
has not shipped in any tagged release yet, and `@fonoster/voice`/`@fonoster/sdk` do not
yet publish a version carrying this contract. This proposal's spec and design are
written against PR #893's documented contract; the dependency bump and build stage are
blocked until a Fonoster release actually includes it.

## What Changes

- Rename the `Path` enum value `VOICEMAIL` to `ANSWERED_BY_MACHINE` (`account-contact-log`).
  **BREAKING** for anything keying off the literal string `VOICEMAIL` — confirmed nothing
  in QCobro's own code does today, so this is schema-only, no data migration. Fonoster's
  detector can only report `HUMAN`/`MACHINE`/`UNKNOWN` (never distinguishes a voicemail
  greeting from an IVR), so QCobro collapses both into one value rather than keeping them
  separate — consistent with QCobro collecting from individuals, where IVR pickup on an
  outbound collections call is not expected.
- `VOICE_PRERECORDED` templates gain a per-template toggle, **default on**, to hang up
  instead of playing the script when AMD reports `MACHINE` on that call
  (`agent-templates`, `prerecorded-audio`).
- The voice completion sweep (`account-contact-log`) additionally labels `path:
ANSWERED_BY_MACHINE` when a gestión it finalizes has a CDR reporting `amdStatus:
MACHINE` — for **both** `VOICE_PRERECORDED` and `VOICE_AI` gestións it finalizes.
  For Voz IA this only covers calls that never reached the autopilot's own
  `conversation.ended` webhook (the sweep only finalizes gestións stuck at
  `DISPATCHED`); a call that does complete a live conversation keeps recording
  `path: ENGAGED` regardless of `amdStatus`, because Fonoster's AMD does not stop the
  call from reaching the autopilot and nothing yet exposes the verdict to the
  autopilot's own decision loop. This is a documented limitation, not a bug — making the
  autopilot itself react to AMD in real time needs a separate upstream capability from
  Fonoster and is tracked as a new, distinct follow-up issue.

## Capabilities

### New Capabilities

(none — this only modifies existing capabilities)

### Modified Capabilities

- `account-contact-log`: `Path` enum rename (`VOICEMAIL` → `ANSWERED_BY_MACHINE`);
  `VOICE_PRERECORDED` becomes able to reach `ANSWERED_BY_MACHINE` (previously only
  `ENGAGED`); the voice completion sweep gains AMD-derived `path` labeling alongside its
  existing `delivery`/`deliveryReason` classification.
- `prerecorded-audio`: new requirement — the co-located VoiceServer hangs up without
  playing the script when AMD reports `MACHINE` and the template's toggle is on,
  recording the same `delivery: FAILED` / `deliveryReason: UNREACHABLE` pairing already
  used for "answered but script didn't play," now additionally carrying
  `path: ANSWERED_BY_MACHINE` to distinguish an intentional skip from a real failure.
- `agent-templates`: `VoicePrerecordedConfig` gains `hangupOnMachineDetected Boolean`
  (default `true`).

## Impact

- `mods/apiserver/prisma/schema.prisma` + a new migration (enum value rename, new
  `voice_prerecorded_configs` column).
- `mods/common/src/schemas/{contactLog,agentTemplates,dispatch}.ts` and their `types/`
  companions.
- `mods/apiserver/src/voice/voiceServer.ts` (hang-up branch), `dispatchOutreach.ts` and
  the two outreach/campaign-engine mapping sites (metadata plumbing),
  `createAgentTemplate.ts`/`updateAgentTemplate.ts` (persist the field).
- `mods/apiserver/src/services/fonosterOutboundCallClient.ts` (read `amdStatus`/
  `amdCause` off the CDR), `voiceCompletionTimeoutSweep.ts` (classify + label `path`),
  `recordVoiceAiCallStatus.ts` (write `path`).
- `mods/webapp/src/lib/i18n.tsx` (renamed path label, both locales) and
  `mods/webapp/src/pages/AgentTemplates.tsx` (new checkbox in the create/edit
  `VOICE_PRERECORDED` form, matching the existing `normalizeGsm7` checkbox pattern).
- Dependency bump: `@fonoster/voice`/`@fonoster/sdk` 0.22.10/0.22.11 → whatever release
  first ships PR #893 (not yet published — this blocks the build stage only).
- GitHub issues: narrow/close #83; file a new issue for real-time Voz IA/Autopilot AMD
  reaction, blocked on Fonoster.
