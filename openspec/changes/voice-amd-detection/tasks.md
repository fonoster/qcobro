## 1. Schema & migrations

- [x] 1.1 Confirm zero live `Path = 'VOICEMAIL'` rows in prod before renaming (query, not a
      backfill). Confirmed zero rows on the local dev DB (245 null, 49 ENGAGED, 0 other) —
      re-verify against prod specifically before deploying, since this session only had
      dev-DB access.
- [x] 1.2 `mods/apiserver/prisma/schema.prisma`: rename `Path` enum value `VOICEMAIL` →
      `ANSWERED_BY_MACHINE`; add `VoicePrerecordedConfig.hangupOnMachineDetected Boolean
  @default(true)`.
- [x] 1.3 Hand-write the migration: `ALTER TYPE "Path" RENAME VALUE 'VOICEMAIL' TO
  'ANSWERED_BY_MACHINE';` and `ALTER TABLE "voice_prerecorded_configs" ADD COLUMN
  "hangupOnMachineDetected" BOOLEAN NOT NULL DEFAULT true;` (follow the
      `20260907120000_contact_log_axes_english_names` / `20260911120000_sms_normalize_gsm7`
      precedents — no Prisma-generated drop+recreate).
- [x] 1.4 Run the migration against a dev DB; confirm no data loss. Applied via `prisma
    migrate deploy` against the local dev Postgres (`qcobro-db-1`); verified via `psql`;
      regenerated the Prisma client.

## 2. Shared schemas (`mods/common`)

- [x] 2.1 `schemas/contactLog.ts`: rename `pathSchema`'s `VOICEMAIL` literal to
      `ANSWERED_BY_MACHINE`; update the two doc comments referencing the old name/issue #83.
- [x] 2.2 `schemas/contactLog.test.ts`: rename the test asserting the old literal is
      rejected/reachable; add a case for the new value where relevant.
- [x] 2.3 `schemas/agentTemplates.ts` + `types/agentTemplates.ts`: add
      `hangupOnMachineDetected` (boolean, optional on input with server-side default true) to
      the `VOICE_PRERECORDED` create/update schema and `VoicePrerecordedConfigRecord` type.
- [x] 2.4 `schemas/dispatch.ts` + `types/dispatch.ts`: add `hangupOnMachineDetected` to
      `dispatchOutreachSchema`/`DispatchOutreachInput`; add `amdStatus?: "HUMAN" | "MACHINE" |
  "UNKNOWN"` to `VoiceCallLookupResult`.
- [x] 2.5 Build `mods/common` and confirm no downstream type errors yet (apiserver/webapp
      updates land in the following sections). `tsc -b --force` clean; 271/271 tests pass.

## 3. Pre-recorded hang-up (apiserver)

- [x] 3.1 `createAgentTemplate.ts` / `updateAgentTemplate.ts`: persist
      `hangupOnMachineDetected` on `VoicePrerecordedConfig`. (Update path needs no change —
      `config` is an unvalidated bag passed straight to Prisma; no cross-field validation
      applies to this field.)
- [x] 3.2 `trpc/routers/outreach.ts` (manual outreach — actual path, not
      `functions/outreach/outreach.ts` as originally noted) and campaigns `engine.ts` +
      `prismaEngineClient.ts`: map `hangupOnMachineDetected` alongside the existing DTMF
      fields.
- [x] 3.3 `dispatchOutreach.ts`: add `metadata.hangupOnMachineDetected` to the
      `VOICE_PRERECORDED` metadata bag, same shape as `repeatDigit` et al. (explicit `!=
    null` check, not truthy — `false` must still ride through).
- [x] 3.4 `voiceServer.ts`: read `req.amd?.status` (via a local `VoiceRequestWithAmd`
      augmentation type until `@fonoster/voice` publishes the real field) and
      `req.metadata?.hangupOnMachineDetected` (default true when absent) in
      `startVoiceServer`; thread both into `runPrerecordedCall`/`handlePrerecordedCall`.
- [x] 3.5 `handlePrerecordedCall`: branch between `answer()` and `say(message)` — on
      `MACHINE` + toggle-on, skip `say`/DTMF and hang up immediately, returning
      `path: "ANSWERED_BY_MACHINE"`. `runPrerecordedCall` now derives `scriptCompleted` from
      `path !== "ANSWERED_BY_MACHINE"` instead of always `true` on a clean return. Updated
      the stale doc comments, plus `recordPrerecordedOutcome.ts`'s comment on the same
      invariant (no code change needed there — it already forwards `path` generically).
- [x] 3.6 `engine/emulators.ts`: no code change needed — `EmulatedOutboundCallClient.
    setCallDetail` already takes the full `VoiceCallLookupResult`, which now includes
      `amdStatus` from the `mods/common` type extension in §2.

## 4. Voz IA sweep-path labeling (apiserver)

- [x] 4.1 `fonosterOutboundCallClient.ts`: read `amdStatus` defensively off the raw SDK
      `CallDetailRecord` (via a local `CallDetailRecordWithAmd` cast + `parseAmdStatus`
      validator) in `getCall()`, same treat-the-wire-as-unreliable pattern as `parseEndedAt`.
      (`amdCause` from the design's Impact section turned out unnecessary — nothing in this
      change consumes it; only `amdStatus` is read.)
- [x] 4.2 `voiceCompletionTimeoutSweep.ts`: `classify()` now returns `{ deliveryReason, path?
    } | null` (was `DeliveryReason | null`); sets `path: "ANSWERED_BY_MACHINE"` whenever
      `amdStatus === "MACHINE"`, alongside whichever `deliveryReason` applies. Threaded
      through the main loop and `VoiceOutcomeRecorder`.
- [x] 4.3 `recordVoiceAiCallStatus.ts`: added `path` to `voiceAiCallStatusInputSchema`, the
      `VoiceAiCallStatusClient.updateMany` data shape, and the write itself.
- [x] 4.4 Confirmed: `decideVoiceOutcome.ts`/`decidePath()` untouched, per the design's scope
      decision.

Verification for §3–4: `tsc --noEmit` clean, `eslint` clean, and the full apiserver suite
(555/555) plus the specifically-touched files (84 tests) pass. Worktree setup gotchas hit
and resolved along the way: this worktree had no `node_modules` at all (Node module
resolution was silently walking up to the _main checkout's_ `node_modules/@qcobro/common`,
per `[[project_worktree_tooling_gotchas]]`) — fixed with a root `npm install` +
`prisma generate` inside the worktree; also copied `config/qcobro.example.json` →
`config/qcobro.json` (git-ignored) since `voiceServer.ts`'s test suite loads it at import
time.

## 5. Dependency bump (gated)

- [ ] 5.1 **Still blocked as of 2026-09-12**: re-checked `npm view @fonoster/voice
    versions --json` / `@fonoster/sdk` — latest published are still 0.22.10/0.22.11; no
      release contains PR #893 yet (confirmed via its own CI logs earlier in this session:
      merged to `main`, not in any tag/release). §3/§4 were built against local type
      augmentations (`VoiceRequestWithAmd` in `voiceServer.ts`, `CallDetailRecordWithAmd` in
      `fonosterOutboundCallClient.ts`) precisely so this gate doesn't block the rest of the
      build. Re-run this check before resuming §5.2–5.3.
- [ ] 5.2 Bump `@fonoster/voice`/`@fonoster/sdk` in `mods/apiserver/package.json` to that
      version once confirmed.
- [ ] 5.3 Reconcile the design's assumed `VoiceRequest.amd`/`CallDetailRecord.amdStatus`
      shape against the actual published `.d.ts` files; adjust types 2.4/3.4/4.1 if the real
      shape differs, and delete the two local augmentation types/TODOs once the real fields
      are in place.

## 6. Webapp

- [x] 6.1 `lib/i18n.tsx`: rename `gestiones.path.VOICEMAIL` →
      `gestiones.path.ANSWERED_BY_MACHINE` in both EN and ES locale tables. (No code change
      needed in `contactAxes.ts` — `pathWord()`'s generic fallthrough already handles any
      non-`ENGAGED` value, confirmed by re-reading it.)
- [x] 6.2 `pages/AgentTemplates.tsx`: added a `hangupOnMachineDetected` checkbox (default
      checked) to the `VOICE_PRERECORDED` fields in both the create and edit modals,
      following the `normalizeGsm7` boolean-state pattern exactly (dedicated `useState`,
      seeded from `full.voicePrerecordedConfig?.hangupOnMachineDetected` on edit-modal load,
      included directly in both mutation payloads). New i18n key
      `agents.form.hangupOnMachineDetected` (EN/ES).
- [x] 6.3 Pencil: added during the design stage (see checkpoint) — checkbox added to
      "Crear agente · Voz pregrabada"; no edit-modal mock exists for this channel to update
      in parallel (pre-existing gap, not introduced by this change).

Verification for §6: `tsc -p tsconfig.app.json --noEmit` and `eslint` both clean. No webapp
unit-test runner is configured in this repo (no `test` script) — Storybook/e2e coverage is
addressed in §7.

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
