## Why

Three things about a Voz IA agent's speech handling need to change:

- **Callers who switch languages go unheard.** Each synced Fonoster application sends the
  template's `language` to Deepgram. On a Spanish agent, a debtor who answers the phone with
  "Hello" produces no transcript at all, so the agent never gets a turn and stays silent until
  the idle timeout. Fonoster (fonoster/fonoster#910) now accepts Deepgram's `multi`
  code-switching mode, which recognizes mixed-language speech without naming the languages.
- **Spanish recognition uses the generic model.** Templates default to `es`. The deployment's
  STT model is Nova-3, which also offers Latin American Spanish (`es-419`), a closer match for
  QCobro's market.
- **Barge-in is always off.** `allowUserBargeIn: false` is hard-coded in
  `autopilotTemplate.json`, so a caller can never interrupt the agent mid-sentence. Some
  scripts want the caller to be able to cut in.

## What Changes

- The voice template language options become `es-419` (Español · Latinoamérica, the default),
  `en`, and, for `VOICE_AI` only, `multi` (Multilingüe), labeled for when callers are expected
  to mix languages. `es` is no longer offered; no backwards compatibility is kept for it.
- A `VOICE_AI` template whose language is `multi` syncs with speech-to-text
  `languageCode: "multi"`; if the deployment's `sttModel` can't do `multi` (Deepgram supports it
  on `nova-3` and `nova-2` only) the synced application uses `nova-3`.
- New per-template boolean `allowUserBargeIn` on `VOICE_AI` (default `false`), persisted as a
  `NOT NULL DEFAULT false` column and sent as `conversationSettings.allowUserBargeIn`,
  replacing the hard-coded value; `evaluate()` sends `false`.
- Every on/off setting in the agent-template forms becomes a switch (the existing `Switch`
  component) instead of a checkbox: barge-in plus the SMS "avoid costly characters" and
  pre-recorded "hang up on answering machine" options. Presentation only. Multi-select lists
  (the campaign portfolio picker) keep checkboxes.
- Seed data, the seed autopilot YAML (`es-ES`, not a Deepgram Spanish code) and the voice eval
  YAML move to `es-419`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-templates`: "Voice template config fields" gains `allowUserBargeIn`, the language
  options, and scenarios for `multi`, the `es-419` default, and barge-in reaching the synced
  application.

## Impact

- **`mods/common`**: `schemas/agentTemplates.ts` (`allowUserBargeIn`, `MULTILINGUAL_LANGUAGE`,
  `DEFAULT_VOICE_LANGUAGE`), `types/agentTemplates.ts`, `types/voiceApplication.ts`.
- **`mods/apiserver`**: Prisma schema + migration `voice_ai_barge_in`;
  `createAgentTemplate.ts`, `syncVoiceApplication.ts`, `fonosterVoiceApplicationClient.ts`,
  `autopilotTemplate.json`; seed script + YAML.
- **`mods/webapp`**: `AgentTemplates.tsx`, `AgentTemplateDetail.tsx`, `i18n.tsx`; e2e specs.
- **Dependency:** selecting `multi` requires a Fonoster apiserver that includes
  fonoster/fonoster#910; against an older one the sync fails ("Error de sincronización",
  retryable). `es-419` works with the Fonoster already deployed.
- **Data:** no migration of existing `es` rows. They keep syncing as `es`; the form shows the
  default option for them until the operator saves a new language.
