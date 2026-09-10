## Why

Fonoster AUTOPILOT idle options (the prompt spoken when the caller goes quiet, how long
to wait, and how many times to retry before hanging up) are currently a single hard-coded
block in `autopilotTemplate.json`, applied identically to every synced Voz IA app
(PR #165). Collections scripts differ by deployment, portfolio, and agent persona — the
re-engagement line and the silence tolerance need to be tuned per template, not once
globally. Field feedback since PR #165 also indicates the 4500 ms timeout is still too
short; the deployment default should move to ~8 s.

## What Changes

- Add three per-template fields to the `VOICE_AI` agent template: `idleMessage`
  (non-empty string), `idleTimeout` (integer milliseconds, ≥ 3000), `idleMaxTimeoutCount`
  (integer, ≥ 1).
- Persist them on the `voice_ai_configs` child table as **NOT NULL** columns; a migration
  adds the columns and backfills every existing row from a shared default constant.
- Expose the three fields in the console create/edit agent-template forms (VOICE_AI
  branch) and as read-only rows on the template detail page, with i18n label/hint/
  placeholder keys.
- Introduce one exported constant `DEFAULT_VOICE_IDLE_OPTIONS` in `@qcobro/common`
  (`message` / `timeout` 8000 / `maxTimeoutCount` 3). The schema fields carry
  `.default(...)` pointing at it so the eval-template schema (which `.extend`s the same
  VOICE_AI member) and `agents:create` calls that omit them keep working untouched.
- `buildRequest()` in `fonosterVoiceApplicationClient` builds
  `conversationSettings.idleOptions` from the template's three fields; `evaluate()` (which
  has no template row) builds it from the constant.
- **BREAKING (data only, no API break):** remove the `idleOptions` block from
  `autopilotTemplate.json` — both call paths now supply it explicitly. The migration
  backfill sets `idleTimeout: 8000` for already-created templates, superseding PR #165's
  4500; existing agents pick it up on their next Fonoster re-sync.
- Align `scripts/assets/autopilot.yaml`'s `idleOptions` to the new default so the scaffold
  stays consistent.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-templates`: the "Voice template config fields" requirement gains three
  `VoiceAiConfig` fields (`idleMessage`, `idleTimeout`, `idleMaxTimeoutCount`), plus a
  scenario that a VOICE_AI template saved without explicit idle options is stored with the
  deployment defaults and those values are what the synced Fonoster application's
  `conversationSettings.idleOptions` carries.

## Impact

- **`mods/common`**: `schemas/agentTemplates.ts` (VOICE_AI member + new constant),
  `types/agentTemplates.ts` (`VoiceAiConfigRecord`), `types/voiceApplication.ts`
  (`VoiceApplicationInput`). `schemas/agentEvaluations.ts` is unaffected because the
  fields default.
- **`mods/apiserver`**: `prisma/schema.prisma` + new migration; `functions/agentTemplates/`
  (`createAgentTemplate.ts`, `syncVoiceApplication.ts`, `updateAgentTemplate.ts` verify);
  `services/fonosterVoiceApplicationClient.ts`; `services/autopilotTemplate.json` (remove
  block); `scripts/assets/autopilot.yaml`.
- **`mods/webapp`**: `pages/AgentTemplates.tsx`, `pages/AgentTemplateDetail.tsx`,
  `lib/i18n.tsx`, plus the agent-template Storybook story and `e2e/` flow if it asserts
  the form.
- **`mods/ctl`**: no new flags; `agents/create.ts` keeps working via `.default()`.
- **OpenSpec**: `specs/agent-templates/spec.md` delta.
- **Data**: every existing `voice_ai_configs` row is backfilled; `idleTimeout` moves
  4500 → 8000 for pre-existing templates.
