## 1. Shared contracts (`mods/common`)

- [x] 1.1 Add `DEFAULT_VOICE_IDLE_OPTIONS` (`message` / `timeout: 8000` / `maxTimeoutCount: 3`) as an exported `as const` constant in `mods/common/src/schemas/agentTemplates.ts`, exported through the barrel.
- [x] 1.2 Add `idleMessage` (`z.string().min(1).default(...)`), `idleTimeout` (`z.number().int().min(3000).default(...)`), `idleMaxTimeoutCount` (`z.number().int().min(1).default(...)`) to the `VOICE_AI` member of `createAgentTemplateSchema`, each `.default()` pointing at the constant.
- [x] 1.3 Add the three fields to `VoiceAiConfigRecord` in `mods/common/src/types/agentTemplates.ts` (`idleMessage: string`, `idleTimeout: number`, `idleMaxTimeoutCount: number`).
- [x] 1.4 Add the three fields to `VoiceApplicationInput` in `mods/common/src/types/voiceApplication.ts` (required, not optional).
- [x] 1.5 Confirm `evalTemplateSchema` in `mods/common/src/schemas/agentEvaluations.ts` still type-checks with no edit (the `.extend`ed VOICE_AI member now defaults the fields).
- [x] 1.6 `npm run build -w @qcobro/common`.

## 2. Persistence (`mods/apiserver` Prisma)

- [x] 2.1 Add `idleMessage String`, `idleTimeout Int`, `idleMaxTimeoutCount Int` (non-optional) to `model VoiceAiConfig` in `mods/apiserver/prisma/schema.prisma`.
- [x] 2.2 Create `mods/apiserver/prisma/migrations/<timestamp>_voice_ai_idle_options/migration.sql`: add the three columns nullable, `UPDATE` backfill from the constant's literal values (`idleTimeout` 8000), then `ALTER COLUMN ... SET NOT NULL` for each. Header comment explains the PR #165 4500→8000 supersession and points at `DEFAULT_VOICE_IDLE_OPTIONS`.
- [x] 2.3 Run the migration against a live DB if one is available (`prisma migrate dev`/`deploy`); otherwise note it was not run live.

## 3. apiserver wiring

- [x] 3.1 `functions/agentTemplates/createAgentTemplate.ts` — write `idleMessage`, `idleTimeout`, `idleMaxTimeoutCount` into the `voiceAiConfig.create` data (values always present post-parse via `.default()`).
- [x] 3.2 `functions/agentTemplates/updateAgentTemplate.ts` — verify the loose `config` bag forwards the three keys to `voiceAiConfig.update` unchanged; no code change expected, add a note/test.
- [x] 3.3 `functions/agentTemplates/syncVoiceApplication.ts` — pass `cfg.idleMessage`, `cfg.idleTimeout`, `cfg.idleMaxTimeoutCount` into the `VoiceApplicationInput`.
- [x] 3.4 `services/fonosterVoiceApplicationClient.ts` `buildRequest()` — set `conversationSettings.idleOptions` from `input.idleMessage/idleTimeout/idleMaxTimeoutCount`, after the template spread so it overrides.
- [x] 3.5 `services/fonosterVoiceApplicationClient.ts` `evaluate()` — set `conversationSettings.idleOptions` from `DEFAULT_VOICE_IDLE_OPTIONS`.
- [x] 3.6 `services/autopilotTemplate.json` — remove the `idleOptions` block; keep `allowUserBargeIn`, `goodbyeMessage`, `systemErrorMessage`.
- [x] 3.7 `scripts/assets/autopilot.yaml` — align `idleOptions` to the new default (message + `timeout: 8000` + `maxTimeoutCount: 3`).

## 4. Design (Pencil, before webapp code)

- [x] 4.1 Read the `pencil` MCP skill, open `pencil.pen`, locate the VOICE_AI agent-template create/edit form frame (check the shared component definition + descendant overrides, not just a name search).
- [x] 4.2 Add the three fields to that form matching existing field styling; inputs neutral/white, green only for the primary CTA, every color a token. Save.

## 5. Console (`mods/webapp`)

- [x] 5.1 `lib/i18n.tsx` — add `agents.form.*` label + hint/placeholder keys for the three fields in `en`, `es`, and every other locale present.
- [x] 5.2 `pages/AgentTemplates.tsx` `CreateAgentTemplateModal` VOICE_AI branch — three inputs (`idleMessage` textarea/input, `idleTimeout` number, `idleMaxTimeoutCount` number), pre-filled from `DEFAULT_VOICE_IDLE_OPTIONS`, required, wired into the create payload.
- [x] 5.3 `pages/AgentTemplates.tsx` `EditAgentTemplateModal` VOICE_AI branch — same three inputs, wired into the edit `config` bag; seeded from the loaded template.
- [x] 5.4 `pages/AgentTemplateDetail.tsx` — read-only `ConfigRow`s for the three fields.

## 6. CLI (`mods/ctl`)

- [x] 6.1 Confirm `commands/agents/create.ts` needs no new flags and still type-checks / dry-parses with the three fields omitted (defaults apply).

## 7. Tests & validation

- [x] 7.1 `mods/common` unit tests: min bounds reject (`idleTimeout` < 3000, `idleMaxTimeoutCount` < 1, empty `idleMessage`); defaults applied when omitted; `DEFAULT_VOICE_IDLE_OPTIONS` values (8000 / 3).
- [x] 7.2 `mods/apiserver` tests: `buildRequest()` puts `idleOptions` from the input and overrides the template; `evaluate()` puts `idleOptions` from the constant; `createAgentTemplate` persists the three fields; `syncVoiceApplication` forwards them.
- [x] 7.3 No new Storybook story: the form is composed entirely of already-storied `InputGroup`/`TextareaGroup` primitives and no new component was introduced (repo has stories for `components/` only, none for page modals). `e2e/campaigns-core.spec.ts` VOICE_AI flow updated to assert the three idle fields render pre-filled (8000 / 3 / non-empty).
- [x] 7.4 Run `npm test -w @qcobro/common -w @qcobro/apiserver`, webapp tests, `prettier --check` + `eslint` on changed files.
- [x] 7.5 `npx openspec validate voice-ai-idle-options --strict`.

## 8. Ship

- [ ] 8.1 Conventional Commits per package, DCO `Signed-off-by`, no Claude attribution anywhere.
- [ ] 8.2 Open PR against `main`: what changed, the #165 supersession (4500→8000 on backfill), re-sync path for existing agents, and any stage not run live (DB/e2e).
- [ ] 8.3 `/opsx:archive voice-ai-idle-options` (folds the spec delta into `openspec/specs/agent-templates/spec.md`).
