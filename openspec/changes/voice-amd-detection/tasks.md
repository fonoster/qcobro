## 1. Schema & migrations

- [ ] 1.1 Confirm zero live `Path = 'VOICEMAIL'` rows in prod before renaming (query, not a
      backfill).
- [ ] 1.2 `mods/apiserver/prisma/schema.prisma`: rename `Path` enum value `VOICEMAIL` →
      `ANSWERED_BY_MACHINE`; add `VoicePrerecordedConfig.hangupOnMachineDetected Boolean
    @default(true)`.
- [ ] 1.3 Hand-write the migration: `ALTER TYPE "Path" RENAME VALUE 'VOICEMAIL' TO
    'ANSWERED_BY_MACHINE';` and `ALTER TABLE "voice_prerecorded_configs" ADD COLUMN
    "hangupOnMachineDetected" BOOLEAN NOT NULL DEFAULT true;` (follow the
      `20260907120000_contact_log_axes_english_names` / `20260911120000_sms_normalize_gsm7`
      precedents — no Prisma-generated drop+recreate).
- [ ] 1.4 Run the migration against a dev DB; confirm no data loss.

## 2. Shared schemas (`mods/common`)

- [ ] 2.1 `schemas/contactLog.ts`: rename `pathSchema`'s `VOICEMAIL` literal to
      `ANSWERED_BY_MACHINE`; update the two doc comments referencing the old name/issue #83.
- [ ] 2.2 `schemas/contactLog.test.ts`: rename the test asserting the old literal is
      rejected/reachable; add a case for the new value where relevant.
- [ ] 2.3 `schemas/agentTemplates.ts` + `types/agentTemplates.ts`: add
      `hangupOnMachineDetected` (boolean, optional on input with server-side default true) to
      the `VOICE_PRERECORDED` create/update schema and `VoicePrerecordedConfigRecord` type.
- [ ] 2.4 `schemas/dispatch.ts` + `types/dispatch.ts`: add `hangupOnMachineDetected` to
      `dispatchOutreachSchema`/`DispatchOutreachInput`; add `amdStatus?: "HUMAN" | "MACHINE" |
    "UNKNOWN"` to `VoiceCallLookupResult`.
- [ ] 2.5 Build `mods/common` and confirm no downstream type errors yet (apiserver/webapp
      updates land in the following sections).

## 3. Pre-recorded hang-up (apiserver)

- [ ] 3.1 `createAgentTemplate.ts` / `updateAgentTemplate.ts`: persist
      `hangupOnMachineDetected` on `VoicePrerecordedConfig`.
- [ ] 3.2 `functions/outreach/outreach.ts` and campaigns `engine.ts` +
      `prismaEngineClient.ts`: map `hangupOnMachineDetected` alongside the existing DTMF
      fields.
- [ ] 3.3 `dispatchOutreach.ts`: add `metadata.hangupOnMachineDetected` to the
      `VOICE_PRERECORDED` metadata bag, same shape as `repeatDigit` et al.
- [ ] 3.4 `voiceServer.ts`: read `req.amd?.status` and
      `req.metadata?.hangupOnMachineDetected` (default true when absent) in
      `startVoiceServer`; thread both into `runPrerecordedCall`/`handlePrerecordedCall`.
- [ ] 3.5 `handlePrerecordedCall`: branch between `answer()` and `say(message)` — on
      `MACHINE` + toggle-on, skip `say`/DTMF and hang up immediately, returning
      `path: "ANSWERED_BY_MACHINE"` instead of the current always-`ENGAGED` return. Update
      the stale doc comments asserting "reaching this return means the script played."
- [ ] 3.6 `engine/emulators.ts`: extend `EmulatedOutboundCallClient`/the voice-server test
      double with an AMD-carrying variant for tests.

## 4. Voz IA sweep-path labeling (apiserver)

- [ ] 4.1 `fonosterOutboundCallClient.ts`: read `amdStatus`/`amdCause` defensively off the
      raw SDK `CallDetailRecord` in `getCall()`, same treat-the-wire-as-unreliable pattern as
      `parseEndedAt`.
- [ ] 4.2 `voiceCompletionTimeoutSweep.ts`: `classify()` gains a `path` alongside
      `deliveryReason` when the CDR reports `amdStatus: MACHINE`; thread through the sweep's
      main loop and `VoiceOutcomeRecorder`.
- [ ] 4.3 `recordVoiceAiCallStatus.ts`: add `path` to `voiceAiCallStatusInputSchema`, the
      `VoiceAiCallStatusClient.updateMany` data shape, and the write itself.
- [ ] 4.4 Explicitly do NOT touch `decideVoiceOutcome.ts`/`decidePath()` — confirm no changes
      needed there per the design's scope decision.

## 5. Dependency bump (gated)

- [ ] 5.1 Before starting: `npm view @fonoster/voice versions --json` /
      `npm view @fonoster/sdk versions --json` — confirm a release including PR #893 is
      actually published. If not, stop here and flag it; do not guess at the type shape.
- [ ] 5.2 Bump `@fonoster/voice`/`@fonoster/sdk` in `mods/apiserver/package.json` to that
      version once confirmed.
- [ ] 5.3 Reconcile the design's assumed `VoiceRequest.amd`/`CallDetailRecord.amdStatus`
      shape against the actual published `.d.ts` files; adjust types 2.4/3.4/4.1 if the real
      shape differs.

## 6. Webapp

- [ ] 6.1 `lib/i18n.tsx`: rename `gestiones.path.VOICEMAIL` →
      `gestiones.path.ANSWERED_BY_MACHINE` in both EN and ES locale tables.
- [ ] 6.2 `pages/AgentTemplates.tsx`: add a "hang up when a machine/voicemail is detected"
      checkbox to the `VOICE_PRERECORDED` fields in both the create and edit modals, following
      the existing `normalizeGsm7` checkbox pattern (default checked).
- [ ] 6.3 Pencil: add the checkbox to the agent-template create/edit frames before building
      (design-first per CLAUDE.md); confirm visually against the live style.

## 7. Tests

- [ ] 7.1 `contactLog.test.ts`: renamed-value coverage (see 2.2).
- [ ] 7.2 `voiceServer.test.ts` (or equivalent): MACHINE-detected early-hangup branch, both
      toggle-on and toggle-off, plus the existing early-hangup-catch path unaffected.
- [ ] 7.3 `voiceCompletionTimeoutSweep.test.ts`: `amdStatus: MACHINE` sets `path`;
      no-`amdStatus` leaves `path` null; idempotency (already-finalized gestión untouched).
- [ ] 7.4 `recordVoiceAiCallStatus.test.ts`: `path` write path.
- [ ] 7.5 Run repo lint/typecheck/test scripts; all green before sync.

## 8. Manual verification & issue tracker

- [ ] 8.1 With `APISERVER_AMD_ENABLED` on in a test workspace (once available), run a real
      dev-stack pre-recorded call against a known voicemail number; confirm dead air, hang-up,
      and the gestión's recorded `path`/`delivery`.
- [ ] 8.2 Narrow/close GitHub issue #83.
- [ ] 8.3 File a new issue: "Let Voz IA (Autopilot) react to AMD in real time" — blocked on
      Fonoster exposing `amd` to the autopilot's own decision loop.
