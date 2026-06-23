## 1. Config

- [x] 1.1 Add optional `ai` section to `qcobroConfigSchema` (`@qcobro/common/config`):
      `enabled`, `provider` (mock|google|openai|anthropic), `apiKey`, `model` (default
      gemini-2.5-flash), `temperature`, `maxTokens`, `generation` (onDemand|onIngestion)
- [x] 1.2 Add per-provider model validation (reject invalid model for provider) at load
- [x] 1.3 Document the `ai` section in `qcobro.example.json` (disabled by default)

## 2. LLM port + adapter

- [x] 2.1 Define the `InsightGenerator` port (types/insight) + structured-analysis schema
      (schemas/insight: aiSummary, aiSentiment enum, aiDebtReason, aiResult, aiNextStep)
- [x] 2.2 Implement the adapter via REST (lighter than LangChain SDKs): `mock` (offline,
      deterministic) + `google` (Gemini REST); JSON prompt in the call's language, Zod-validated.
      `openai`/`anthropic` REST adapters are a follow-up (config-valid, runtime "not implemented")
- [x] 2.3 Wire the generator into the tRPC context (DI), gated on `ai.enabled`

## 3. Generation function + transport

- [x] 3.1 Validated function `generateGestionInsight` (inject generator + Prisma):
      transcript-only gating, generate, persist `ai*`, idempotent (skip if already analyzed)
- [x] 3.2 Unit tests (5): generates+persists, cached-skip, no-transcript, disabled, and a
      validation-failure case
- [x] 3.3 Workspace-scoped tRPC mutation `campaigns.contactLog.generateInsight`
- [x] 3.4 `onIngestion` mode: generate from the voice webhook path (best-effort, post-response)

## 4. Console (web-console delta)

- [x] 4.1 On opening a Voz IA gestión with a transcript and no analysis, call `generateInsight`,
      then refetch so the analysis renders
- [x] 4.2 Generating / "Análisis IA pendiente" states in the analysis section
- [x] 4.3 i18n keys for the generating state (en + es)

## 5. Tests + verification

- [x] 5.1 Generation/cache/gate/disabled behavior covered by the unit tests (3.2)
- [ ] 5.2 e2e `ai-insights.spec.ts` (on-open analysis section) — WRITTEN but currently
      BLOCKED: every e2e signs up + creates a workspace, and `createFirstWorkspace` is
      regressed on `main` (the merged `workspaces.summaries`/CreateWorkspace change no longer
      redirects after creating the first workspace). Unblock that, then this e2e runs.
- [x] 5.3 One-way channels (SMS/Pre-grabada/Email) unaffected — they have no transcript so
      analysis never runs; their generic insight is unchanged

## 6. Follow-ups (track, not in this change)

- [ ] 6.1 Secure the `POST /api/voice/events` webhook (auth/signing + workspace scoping)
- [ ] 6.2 `openai` + `anthropic` REST adapters
- [ ] 6.3 Optional: `aiAnalyzedAt` marker, fallback vendor, batch backfill, eval harness

## Status

Implementation complete and static-green: typecheck, lint, build, and unit tests (74
apiserver + 10 common) all pass. Live e2e is blocked by an unrelated `createFirstWorkspace`
regression on `main` (see 5.2) — flagged for the user; not caused by this change.
