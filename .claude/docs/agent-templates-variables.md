# Checkpoint — agent-templates (Variables disponibles section)

- **Status**: DONE (stage 7) — section rewritten, link repointed, broken-link check clean. Page already in nav.
- **Surface**: Mintlify, `docs-site/`
- **Page**: `docs-site/guides/agent-templates.mdx` (UPDATE existing how-to; already in nav under "Operator guides")
- **Diátaxis type**: how-to (the page); the variables section is reference-style within it
- **Assets**: none needed (variable table + code samples)

## Purpose narrative

An operator building an agent needs to know which template variables exist, how to insert
them, and where Handlebars-style logic (variables + conditionals) actually applies. After
reading, they can personalize SMS/WhatsApp/Correo/Voz-pregrabada messages with variables and
conditionals, and understand that Voz IA instead has all contact data available to the agent
through its system prompt (no Handlebars).

## Sources

- `mods/common/src/utils/outreach.ts` — `buildOutreachContext` (variable set + new `isDue`)
- `mods/common/src/types/portfolios.ts` — `PortfolioAccountRecord` fields
- `mods/apiserver/src/functions/outreach/dispatchOutreach.ts` — which channels render via `renderTemplate`; Voz IA no longer resends systemPrompt
- `mods/apiserver/src/trpc/routers/outreach.ts`, `engine.ts` — per-channel field mapping
- `mods/apiserver/src/services/fonosterVoiceApplicationClient.ts` — system prompt stored on synced Fonoster app

## Decision log

- Variables/conditionals = text-rendered channels only: SMS, WhatsApp, Correo, Voz pregrabada (TTS).
- Voz IA: NO Handlebars; contact data available to the agent, referenced in the stored system prompt.
- Correct the prior draft's false "funcionan igual en todos los canales —Voz IA" claim.
