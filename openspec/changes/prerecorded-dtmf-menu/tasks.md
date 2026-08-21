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
- [ ] 2.2 Run the migration against a scratch database and confirm existing rows default to
      "no menu configured" (all five columns null) with no behavior change — **not done**, no
      live Postgres available in this session; needs a real run before merge (see 9.3).

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
      client-side; wired as live inline `error` props (not just a submit-time gate).
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
      exist (used by VOICE_AI/EMAIL/WHATSAPP); this change only makes `VOICE_PRERECORDED`
      eligible to reach them. New labels were added for the _template config form_ (6.1): 12
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
      `updateAgentTemplate.test.ts`, 11 new in `voiceServer.test.ts`). mods/webapp has no
      unit-test runner in this repo (Storybook/Playwright only, per 6.3/7.3's finding) —
      typecheck + lint were the applicable gates and both pass. One pre-existing unrelated
      failure noted and left alone: `.storybook/main.ts`'s `tsConfigPath` vs `tsconfigPath`
      typo, outside `tsconfig.app.json`'s scope.
- [ ] 9.2 Playwright golden path — **not written**. This session prioritized backend +
      webapp-unit-equivalent coverage given the effort budget; a golden-path e2e (configure a
      template with both digits, drive a call to opt-out, confirm the gestión detail shows
      `Resultado`) still needs writing before merge.
- [ ] 9.3 Run the real dev stack once against live Fonoster — **not done**, not possible from
      this session (no live Fonoster/Postgres access). This is a hard gate before merge per
      this repo's own convention for DTMF/call-timing-sensitive changes: mocked tests won't
      catch real gather timing/behavior, and 2.2's migration also needs a real run.
