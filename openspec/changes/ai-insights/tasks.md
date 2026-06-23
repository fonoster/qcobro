## 1. Config

- [ ] 1.1 Add optional `ai` section to `qcobroConfigSchema` (`@qcobro/common/config`):
      `enabled`, `provider` (google|openai|anthropic), `apiKey`, `model` (default
      gemini-2.5-flash-class), `temperature`, `maxTokens`, `generation` (onDemand|onIngestion)
- [ ] 1.2 Add a per-provider model validation (reject invalid model for provider) at load
- [ ] 1.3 Document the `ai` section in `qcobro.example.json` (disabled by default)

## 2. LLM port + adapter (mirror Mikro/autopilot)

- [ ] 2.1 Define the `InsightGenerator` port + structured-analysis types/schema in
      `@qcobro/common` (Zod: aiSummary, aiSentiment enum, aiDebtReason, aiResult, aiNextStep)
- [ ] 2.2 Implement a LangChain multi-vendor adapter (`createChatModel`-style) built from the
      `ai` config; prompt for JSON in the call's language; Zod-validate the response
- [ ] 2.3 Wire the adapter into the tRPC context (DI), gated on `ai.enabled`

## 3. Generation function + transport

- [ ] 3.1 Validated function `generateGestionInsight` (inject `InsightGenerator` + Prisma):
      transcript-only gating, generate, persist `ai*` fields, idempotent (skip if present)
- [ ] 3.2 Unit tests incl. a validation-failure case and the "no transcript → no call" case
- [ ] 3.3 Workspace-scoped tRPC mutation `campaigns.contactLog.generateInsight`
- [ ] 3.4 `onIngestion` mode: call `generateGestionInsight` from the voice webhook path

## 4. Console (web-console delta)

- [ ] 4.1 On opening a Voz IA gestión with a transcript and no analysis (and `onDemand`),
      call `generateInsight`, show a generating state, then render the analysis
- [ ] 4.2 Keep the "Análisis IA pendiente" state when disabled or before generation
- [ ] 4.3 i18n keys for the generating state (en + es)

## 5. Tests + verification

- [ ] 5.1 E2E: enabled `onDemand` — open a Voz IA gestión with a transcript, assert the
      analysis renders and is cached on reopen (LLM stubbed in the dev/test config)
- [ ] 5.2 E2E: disabled — analysis stays pending, no request made
- [ ] 5.3 Confirm one-way channels (SMS/Pre-grabada/Email) are unaffected (generic insight)

## 6. Follow-ups (track, not in this change)

- [ ] 6.1 Secure the `POST /api/voice/events` webhook (auth/signing + workspace scoping)
- [ ] 6.2 Optional: `aiAnalyzedAt` marker, fallback vendor, batch backfill, eval harness
