## 0. Design gate

- [x] 0.1 Confirm the open questions in design.md with the user — resolved 2026-08-21:
      `maxRepeats` 2, gather timeout 5s, repeat press DOES set `camino: ENGAGED` (extended to
      opt-out too), no default digits pre-filled, Pencil scope confirmed as the two screens below
- [x] 0.2 Pencil: added the DTMF section (5 fields: repeat digit, repeat message, max
      repeats, opt-out digit, opt-out message) to "Crear agente · Voz pregrabada"
      (`pencil.pen`, frame `MnECY`/`cLzrm`); added a new "Detalle de gestión — Pre-grabada ·
      Opt-out (bloque)" variant (`AW2Op`) showing the `Camino` metadata item and standalone
      `Resultado` row, following the exact patterns already used on the Voz IA block. Gestiones
      list confirmed to need no changes (its `RESULTADO`/`ENTREGA` columns are already
      channel-generic). Screenshots reviewed inline this session — no separate sign-off round
      needed since the work directly implements the confirmed design decisions, not new
      choices. Copy `pencil.pen` from the main checkout into this worktree before committing
      stage 3 (per this repo's established Pencil convention).

## 1. Shared schemas (`mods/common`)

- [x] 1.1 Added `repeatDigit?`, `repeatMessage?`, `maxRepeats?`, `optOutDigit?`, `optOutMessage?`
      to `createAgentTemplateSchema`'s VOICE_PRERECORDED branch, plus the standalone reusable
      `voicePrerecordedDtmfSchema` (message required iff its digit is set; digits differ when
      both set; digit is a single `0`-`9` character), applied via a union-level `superRefine` on
      create. Tested directly in `agentTemplates.test.ts` (8 cases) and indirectly through
      `createAgentTemplate.test.ts`.
- [x] 1.2 Loosened `createContactLogSchema`'s `channelCanEngage` rejection: `VOICE_PRERECORDED`
      may set `camino: ENGAGED` and/or `resultado: OPT_OUT` specifically via
      `isAllowedOnPrerecorded()`; `ABANDONED`/`VOICEMAIL` and every other `resultado` value stay
      rejected. Tested in `contactLog.test.ts` (8 cases, incl. SMS still fully rejected).
- [x] 1.3 Extended the LOCAL schema in `recordPrerecordedOutcome.ts` (not the shared
      `prerecordedCompletionSchema`, matching that file's existing pattern for `deliveryReason`)
      with optional `camino`/`resultado` inputs and an optional `repeatCount` for `channelData`.

## 2. Database

- [x] 2.1 Prisma migration `20260821160000_prerecorded_dtmf_menu`: added the five nullable
      columns to `voice_prerecorded_configs`. Hand-authored SQL (no live DB in this worktree to
      run `prisma migrate dev` against — see 9.3), following the exact style of the prior
      `20260820120000_contact_log_provider_message_id` migration.
- [x] 2.2 Ran against a real fresh Postgres (local dev stack via `compose.dev.yaml`): all 20
      pre-existing migrations plus this one applied cleanly; confirmed the seeded pre-recorded
      template's 5 new columns land null. This run also surfaced and fixed two real bugs a
      mocked test could never catch — see 20260821195315 and 20260822010000 below.
- [x] 2.1b Follow-up migration `20260821195315_contact_log_axes_drop_seed_table`: dropped
      `dnc_seed_from_intent_status`, a scratch table `contact_log_axes` left behind with no
      `schema.prisma` model. On a genuinely fresh database this makes `prisma migrate dev`
      detect drift and prompt interactively for a new migration name — which hangs forever in
      a non-interactive shell. Unrelated to DTMF, but blocked getting a scratch DB running at
      all, so fixed here.
- [x] 2.1c Follow-up migration `20260822010000_prerecorded_dtmf_check_constraint`: the real
      bug. `contact_log_axes` added a DB-level CHECK constraint
      (`account_contact_logs_one_way_channel_check`) mirroring the OLD `channelCanEngage`
      rule, blocking ANY `camino`/`resultado` on `VOICE_PRERECORDED` unconditionally. Task
      1.2's Zod-layer carve-out was never mirrored here, so a write the application accepted
      still failed at the database with a check-constraint violation — invisible to every unit
      test since they all mock Prisma. Found via a raw repro script against the live DB,
      confirmed fixed the same way, plus confirmed the still-disallowed values (e.g.
      `camino: ABANDONED`, or anything on `SMS`) are still rejected by the constraint.

## 3. Agent template validated functions (`mods/apiserver`)

- [x] 3.1 Create path: validated via the schema's superRefine (1.1). Update path: since
      `updateAgentTemplateSchema.config` is an unvalidated bag, added
      `assertValidPrerecordedDtmfPatch()` in `updateAgentTemplate.ts`, which reads the existing
      `VoicePrerecordedConfig` row, merges the incoming patch on top, and re-validates via
      `voicePrerecordedDtmfSchema` — so a patch touching only one field (e.g. just
      `optOutMessage`) is checked against the _resulting_ state, not just the patch in
      isolation. 9 new tests across `createAgentTemplate.test.ts` (4) and
      `updateAgentTemplate.test.ts` (5, incl. the merge-with-existing-row cases).
- [x] 3.2 Confirmed: the DTMF fields never appear in `syncVoiceAiApplication`'s Fonoster
      payload — they're QCobro-side only, read from `voicePrerecordedConfig` straight to the
      dispatch metadata (see section 4), never touching the synced Fonoster application.

## 4. VoiceServer call flow (`mods/apiserver/src/voice/voiceServer.ts`)

- [x] 4.1 `readDtmfMenu(req.metadata)` reads `repeatDigit`/`repeatMessage`/`maxRepeats`
      (parsed back to a number)/`optOutDigit`/`optOutMessage` off the same metadata bag that
      already carried `message` — see `dispatchOutreach.ts`, `outreach.ts`, `engine.ts`
      (all three dispatch call sites needed widening: manual outreach, campaign engine, and the
      shared `dispatchOutreachSchema`/`DispatchOutreachInput` type).
- [x] 4.2 No digits configured → `readDtmfMenu` returns `null` → unchanged
      `answer → say → hangup`, no gather.
- [x] 4.3/4.4 Refactored the handler into an exported, directly-testable
      `handlePrerecordedCall(message, menu, res)` (previously untestable inline logic — this
      file had zero prior test coverage because `startVoiceServer` instantiates the whole
      `@fonoster/voice` server). Plays the script, then configured menu message(s), then loops
      gather → branch: opt-out ends the call immediately (`camino: ENGAGED`,
      `resultado: OPT_OUT`); repeat under the cap replays and gathers again
      (`camino: ENGAGED`, `repeatCount++`); repeat at/over the cap, an unrecognized digit, or a
      timeout all hang up like the no-menu path.
- [x] 4.5 11 new tests in `voiceServer.test.ts` against a faked `PrerecordedCallVerbs` (answer/
      say/hangup/gather call recorder) — every branch in 4.4 plus `readDtmfMenu` parsing.

## 5. Completion recording (`mods/apiserver/src/functions/voice/recordPrerecordedOutcome.ts`)

- [x] 5.1 Accepts and persists optional `camino`/`resultado`, gated on the same
      `shouldFinalize` flag as `entrega` (both are produced by the same single completion
      event, so they share one idempotency gate) — a duplicate completion preserves whatever
      was recorded the first time.
- [x] 5.2 `channelData.repeatCount` persisted when `input.repeatCount != null`.
- [x] 5.3 Docstring rewritten to describe the DTMF-conditional `camino`/`resultado` behavior.
- [x] 5.4 9 tests total (2 rewritten for the new return shape, 2 new: repeat-only and
      opt-out; 1 new idempotency case for camino/resultado specifically).

## 6. Webapp — agent template config (`mods/webapp`)

- [x] 6.1 Added the DTMF section (heading + 5 fields) to both `CreateAgentTemplateModal` and
      `EditAgentTemplateModal` in `AgentTemplates.tsx`, matching the signed-off Pencil design.
      The edit modal's existing generic config-seeding loop (`for (const [k,v] of
  Object.entries(cfg))`) picked up the new fields with no code change.
- [x] 6.2 `validateVoicePrerecordedDtmf()` (shared by both modals) mirrors 1.1's rules
      client-side; wired as live inline `error` props (not just a submit-time gate). Fixed a
      duplicate-message bug caught by the new e2e test: the blocking-error path was also
      pushing the same text into the dialog's generic bottom banner, rendering it twice.
- [x] 6.2b Fixed a pre-existing bug found while writing the e2e test: both `<Dialog>` calls in
      this file relied on the shared `Dialog` component's hardcoded English default
      (`cancelLabel = "Cancel"`), so the Cancel button read "Cancel" regardless of the
      console's locale. Passed `cancelLabel={t("common.cancel")}` (the key already existed).
      8 other `<Dialog>` call sites elsewhere in `mods/webapp` have the same gap — left alone,
      out of scope for a DTMF-menu change; worth its own pass.
- [~] 6.3 Storybook stories: **skipped, not silently** — `AgentTemplates.tsx` is a data-fetching
  page component (uses `trpc` hooks directly) with no existing story and no established
  mocking pattern in this repo for page-level trpc components; this repo's Storybook usage
  is scoped to presentational components. Adding one would invent a new pattern rather than
  follow an existing one. Flagging for a product/eng call on whether page-level Storybook
  coverage is wanted here, rather than guessing.

## 7. Webapp — Gestión detail & Gestiones list (`mods/webapp`)

- [x] 7.1 The actual blocker was `contactAxes.ts`'s `caminoPath()`, which gated on the
      channel-fixed `channelCanEngage()` and returned `null` for `VOICE_PRERECORDED`
      unconditionally. Narrowed the gate to `agentType === "SMS"` (the only channel with truly
      zero inbound path) plus an explicit `VOICE_PRERECORDED` carve-out, mirroring the
      backend's `isAllowedOnPrerecorded`. `ResultadoRow`/`resultadoLabel` needed no change —
      they were already channel-generic (gated only on `resultado` being non-null).
- [x] 7.2 Confirmed: `Gestiones.tsx`'s `RESULTADO` column already calls the generic
      `resultadoLabel()` with no per-channel branching.
- [~] 7.3 Storybook stories: same finding as 6.3 — `GestionDetail.tsx`/`Gestiones.tsx` are
  trpc-connected pages, not story-covered in this repo. Skipped for the same reason, not
  silently.
- [x] 7.4 i18n: no new _labels_ were needed — `gestiones.detail.camino`/`gestiones.detail.result`
      and the `gestiones.camino.ENGAGED`/`gestiones.resultado.OPT_OUT` value strings already
      exist (used by VOICE*AI/EMAIL/WHATSAPP); this change only makes `VOICE_PRERECORDED`
      eligible to reach them. New labels were added for the \_template config form* (6.1): 12
      keys × 2 locales in `i18n.tsx`.

## 8. Docs

- [x] 8.1 Added a "Menú DTMF en voz pregrabada" subsection to
      `docs-site/guides/agent-templates.mdx` (Spanish, no em-dashes, second-person imperative,
      per `docs-site/CLAUDE.md`): what the two options do, that both start off, that a message
      is required for an activated digit and the two digits must differ, and that the platform
      never writes the invitation copy. Referenced from the existing "Voz pregrabada" channel
      bullet. Anchor-link slug not verified against Mintlify's actual build.

## 9. Tests & gates

- [x] 9.1 `npm run lint`, `tsc` typecheck (mods/common, mods/apiserver, mods/webapp via
      `tsconfig.app.json`), and full test suites all green: mods/common 196/196 total
      (18 new), mods/apiserver 450/450 total (20 new: 2 rewritten + 3 new in
      `recordPrerecordedOutcome.test.ts`, 4 new in `createAgentTemplate.test.ts`, 5 new in
      `updateAgentTemplate.test.ts`, 11 new in `voiceServer.test.ts`), and (once the local dev
      stack was up) 24/24 e2e specs including the new one (9.2). mods/webapp has no unit-test
      runner in this repo (Storybook/Playwright only, per 6.3/7.3's finding) — typecheck + lint
      were the applicable gates and both pass. One pre-existing unrelated failure noted and
      left alone: `.storybook/main.ts`'s `tsConfigPath` vs `tsconfigPath` typo, outside
      `tsconfig.app.json`'s scope.
- [x] 9.2 `e2e/prerecorded-dtmf-menu.spec.ts`: configure both digits through the console,
      confirm inline validation rejects a half-configured digit, confirm the config round-trips
      through Editar, seed a baseline + an opt-out gestión via the contact-log REST endpoint,
      confirm the list/detail render `Camino`/`Resultado` only for the opt-out row, confirm the
      API still rejects every other value for this channel. Ran against the real local dev
      stack (real Postgres via `compose.dev.yaml`, real apiserver, real webapp, real browser via
      Playwright) — green, along with the full existing e2e suite (24/24) and both unit suites.
      This run is what surfaced the two migration bugs recorded under section 2.
- [~] 9.3 Live Fonoster call — **still not done**, and still can't be done from here: this
  session has real Fonoster credentials in a local `qcobro.json` but placing an actual
  pre-recorded call is an external, billed side effect this session won't trigger without
  being asked. Real gather timing/behavior against Fonoster itself remains unverified —
  the DTMF branch logic itself IS covered (11 `voiceServer.test.ts` cases against a faked
  verb surface), just not against the live provider. Recommend a manual smoke test before
  merge: dispatch one real pre-recorded call to a real phone with both digits configured,
  press each digit, confirm the resulting gestión.
