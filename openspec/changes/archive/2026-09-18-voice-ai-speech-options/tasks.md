## 1. Shared contracts (`mods/common`)

- [x] 1.1 Add `allowUserBargeIn` (`z.boolean().default(false)`) to the `VOICE_AI` member of `createAgentTemplateSchema`.
- [x] 1.2 Export `MULTILINGUAL_LANGUAGE = "multi"` and `DEFAULT_VOICE_LANGUAGE = "es-419"`.
- [x] 1.3 Add `allowUserBargeIn` to `VoiceAiConfigRecord` and `VoiceApplicationInput`.
- [x] 1.4 `npm run build -w @qcobro/common`.

## 2. Persistence (`mods/apiserver` Prisma)

- [x] 2.1 `allowUserBargeIn Boolean @default(false)` on `model VoiceAiConfig`.
- [x] 2.2 Migration `20260917120000_voice_ai_barge_in` (`ADD COLUMN ... NOT NULL DEFAULT false`).
- [x] 2.3 Not run against a live DB locally (the shared dev DB belongs to the main checkout's stack); CI's e2e job applies migrations on a fresh DB.

## 3. apiserver wiring

- [x] 3.1 `createAgentTemplate.ts` writes `allowUserBargeIn`.
- [x] 3.2 `updateAgentTemplate.ts` forwards the `config` bag unchanged; test added for `language` + `allowUserBargeIn`.
- [x] 3.3 `syncVoiceApplication.ts` passes `allowUserBargeIn`.
- [x] 3.4 `buildRequest()` — `buildSpeechToTextConfig(sttModel, language)` (`multi` falls back to `nova-3` when the deployment model can't do it); `conversationSettings.allowUserBargeIn` from the input.
- [x] 3.5 `evaluate()` sends `allowUserBargeIn: false`.
- [x] 3.6 `autopilotTemplate.json` — `allowUserBargeIn` removed.
- [x] 3.7 Seed script, seed `autopilot.yaml` (`es-ES`) and `evals/voice-mora-8-30.yaml` → `es-419`.

## 4. Design (Pencil)

- [x] 4.1 Crear/Editar agente (Voz IA): barge-in switch; Idioma shows "Español (Latinoamérica)".
- [x] 4.2 Crear agente · SMS: "Evitar caracteres que encarecen el envío" checkbox → switch.
- [x] 4.3 Crear agente · Voz pregrabada: "Colgar si se detecta un contestador…" switch (was missing from the design).
- [x] 4.4 Agente · Detalle: "Permitir interrupciones" row.

## 5. Console (`mods/webapp`)

- [x] 5.1 `i18n.tsx` — `agents.lang.es-419`, `agents.lang.multi` (label carries "callers mix languages"), barge-in label, detail yes/no; `agents.lang.es` removed.
- [x] 5.2 Language options via `languagesFor(type)`: `es-419`, `en`, plus `multi` for VOICE_AI; default `es-419`; a `multi` language resets to the default when the create modal's type changes away from VOICE_AI.
- [x] 5.3 Create + edit modals: barge-in `Switch`, off by default / seeded from the template.
- [x] 5.4 `AgentTemplateDetail.tsx` — barge-in row.
- [x] 5.5 SMS `normalizeGsm7` and pre-recorded `hangupOnMachineDetected` checkboxes → `Switch` (create + edit).

## 6. Tests & validation

- [x] 6.1 `mods/common`: barge-in defaults/accepts/rejects; language constants.
- [x] 6.2 `mods/apiserver`: STT language passthrough, `multi` + model fallback, barge-in on create/update, `evaluate()` false, create persists/syncs, update forwards.
- [x] 6.3 No new Storybook story (reuses the storied `Switch`). e2e: `Idioma` lookups exact + `es-419`; VOICE_AI flow asserts barge-in off.
- [x] 6.4 build, typecheck, lint, prettier green; common 276/276; apiserver 553 pass / 4 pre-existing failures (fail identically on unmodified code); e2e runs in CI.
- [x] 6.5 `npx openspec validate voice-ai-speech-options --strict`.

## 7. Ship

- [ ] 7.1 Conventional Commits, DCO `Signed-off-by`, no Claude attribution.
- [ ] 7.2 PR against `main`; CI green; merge.
- [ ] 7.3 Sync + archive `voice-ai-speech-options`.
