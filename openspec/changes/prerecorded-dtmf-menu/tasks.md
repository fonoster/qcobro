## 0. Design gate

- [ ] 0.1 Confirm the open questions in design.md with the user (default digits, `maxRepeats`
      default, gather timeout, whether a repeat press ever gets a `camino`, Pencil scope) before
      starting build
- [ ] 0.2 Pencil: update the pre-recorded template config screen with the two digit+message
      pairs and `maxRepeats`; confirm the Gestión detail/Gestiones list changes for a
      pre-recorded `Resultado` row — get explicit sign-off before touching code

## 1. Shared schemas (`mods/common`)

- [ ] 1.1 Add `repeatDigit?`, `repeatMessage?`, `maxRepeats?`, `optOutDigit?`, `optOutMessage?`
      to the `VoicePrerecordedConfig` schema, plus the cross-field validation (message required
      iff its digit is set; digits differ when both set; digit is a single `0`-`9` character)
- [ ] 1.2 Loosen `createContactLogSchema`'s `channelCanEngage` rejection so `VOICE_PRERECORDED`
      may set `resultado: OPT_OUT` specifically, while every other `resultado` value and any
      `camino` value stay rejected for this channel — add a validation-failure test per still-
      rejected combination
- [ ] 1.3 Extend `prerecordedCompletionSchema` (or the local extension in
      `recordPrerecordedOutcome`) with an optional `resultado` input and an optional
      `repeatCount` for `channelData`

## 2. Database

- [ ] 2.1 Prisma migration: add the five nullable columns to `VoicePrerecordedConfig`
- [ ] 2.2 Run the migration against a scratch database and confirm existing rows default to
      "no menu configured" (all five columns null) with no behavior change

## 3. Agent template validated functions (`mods/apiserver`)

- [ ] 3.1 Wire the new field validation into the create/update agent-template validated
      functions; unit tests for each rejection case (digit without message, message without
      digit, matching digits) and the accept case (both pairs configured and valid)
- [ ] 3.2 Confirm Fonoster app sync is unaffected — the new fields are QCobro-side only, not
      part of the Fonoster application payload

## 4. VoiceServer call flow (`mods/apiserver/src/voice/voiceServer.ts`)

- [ ] 4.1 Read the dispatched template's DTMF config (via `req.metadata`, alongside the
      existing rendered `message`) at call time
- [ ] 4.2 When neither digit is configured: unchanged `answer → say → hangup` path (no gather)
- [ ] 4.3 When at least one digit is configured: after the script, play the configured
      message(s), then `gather` one DTMF digit with a bounded timeout
- [ ] 4.4 Branch on the gathered digit: repeat (loop back to play + gather, bounded by
      `maxRepeats`, incrementing `channelData.repeatCount`), opt-out (hang up, mark completion
      with `resultado: OPT_OUT`), anything else/timeout (hang up, no resultado)
- [ ] 4.5 Unit/integration test the branch logic against a faked `VoiceRequest`/`VoiceResponse`
      for: no menu, repeat within cap, repeat at cap, opt-out, unrecognized digit, timeout

## 5. Completion recording (`mods/apiserver/src/functions/voice/recordPrerecordedOutcome.ts`)

- [ ] 5.1 Accept and persist the optional `resultado` from the completion input, alongside the
      existing `entrega`/`duration` logic, respecting the "only ever advance" idempotency rule
      (a `resultado` already recorded is preserved on a duplicate completion)
- [ ] 5.2 Persist `channelData.repeatCount` when present
- [ ] 5.3 Update the function's docstring — it currently states `camino`/`resultado` are never
      set here for this channel; that is no longer true for the opt-out case
- [ ] 5.4 Unit tests: opt-out sets `resultado`; no-menu call leaves it null; duplicate
      completion doesn't clear or duplicate a recorded `resultado`

## 6. Webapp — agent template config (`mods/webapp`)

- [ ] 6.1 Add the DTMF menu section to the pre-recorded template form per the signed-off
      Pencil design: repeat digit + message, opt-out digit + message, max repeats
- [ ] 6.2 Client-side validation mirroring 3.1 (message required with its digit, digits must
      differ), surfaced inline before submit
- [ ] 6.3 Storybook stories for the new form section: empty (no menu), repeat-only,
      opt-out-only, both configured, validation-error states

## 7. Webapp — Gestión detail & Gestiones list (`mods/webapp`)

- [ ] 7.1 Stop hiding the `Resultado` row for `VOICE_PRERECORDED` in the gestión detail panel
      when `resultado` is non-null; keep it hidden when null (no behavior change for the
      common case)
- [ ] 7.2 Confirm the Gestiones list's existing generic `RESULTADO` column already renders the
      pre-recorded opt-out value correctly with no per-channel special-casing needed
- [ ] 7.3 Storybook stories: pre-recorded detail with `resultado` null (existing look,
      regression check) and with `resultado` `OPT_OUT` (new)
- [ ] 7.4 i18n strings for any new labels (EN/ES at minimum, matching the console's existing
      language set)

## 8. Docs

- [ ] 8.1 Update the voz pregrabada section of the agent-templates guide: what the caller can
      press, that the operator must say so in the script/messages for it to be discoverable,
      and that the repeat count is capped

## 9. Tests & gates

- [ ] 9.1 `npm run lint`, `npm run typecheck --workspace ...`, and the full test suites green
      across `mods/common`, `mods/apiserver`, `mods/webapp`
- [ ] 9.2 Playwright golden path: configure a template with both digits, dispatch (or simulate)
      a call that opts out, confirm the gestión detail shows `Resultado`
- [ ] 9.3 Run the real dev stack once against live Fonoster before opening the PR — DTMF gather
      timing/behavior is exactly the kind of thing mocked tests won't catch
