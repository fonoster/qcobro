## Why

A gestión's **AI Insight** ("Análisis IA") is the operator's fastest read on what happened
on a call — summary, sentiment, debt reason, result, and next step. The `AccountContactLog`
already carries those fields (`aiSummary`, `aiSentiment`, `aiDebtReason`, `aiResult`,
`aiNextStep`) and the Voz IA webhook already stores the transcript, but **nothing populates
the analysis** — the Voz IA detail shows "Análisis IA pendiente". This change defines how
the analysis is produced from the transcript by an LLM, configurably and cheaply.

## What Changes

- **Transcript-based AI analysis** for gestiones that captured a conversation. An injectable
  LLM port turns a gestión's transcript (+ light account/debt context) into the structured
  `ai*` fields, in the call's language. Channel-gated: it runs **only** where a transcript
  exists.
- **`qcobro.json` gains an optional `ai` section** — `enabled`, `provider`
  (`google` | `openai` | `anthropic`), `apiKey`, `model` (default `gemini-2.5-flash`),
  `temperature`, `maxTokens`, and `generation` (`onDemand` | `onIngestion`). When absent or
  disabled, no LLM is called and behavior is unchanged (Voz IA shows "pendiente").
- **Generation timing is configurable**, default **`onDemand`**: the analysis is generated
  the first time an operator opens a gestión that has a transcript but no analysis yet, then
  **persisted** to the `ai*` fields and cached (never regenerated automatically). The
  alternative **`onIngestion`** generates it when the webhook stores the transcript. Default
  is on-demand to avoid paying for calls nobody reviews.
- **Per-channel behavior is made explicit** (see Impact): Voz IA gets real analysis; the
  one-way channels (SMS, Pre-grabada, Email) keep the existing generic per-channel insight —
  no LLM, because they capture no customer response to analyze.
- **No implementation in this change** — proposal/specs only.

## Capabilities

### New Capabilities

- `ai-insights`: How a gestión's structured AI analysis is generated from its transcript —
  the LLM port + provider config (`qcobro.json` `ai`), channel gating (transcript-only),
  generation timing (on-demand vs on-ingestion) with persistence/caching, multilingual
  output, and the guardrails for sending transcripts to an external model.

### Modified Capabilities

- `web-console`: The channel-aware gestión detail SHALL request on-demand analysis when a
  Voz IA gestión has a transcript but no analysis yet, showing a generating state and a
  resulting (or "pending") analysis. The one-way channels' generic insight is unchanged.

## Impact

- **`qcobro.json` / `@qcobro/common` config**: new optional `ai` section + Zod schema; safe
  to omit (feature off).
- **`mods/apiserver`**: a validated `generateGestionInsight` function (injected LLM port +
  Prisma) and a workspace-scoped tRPC procedure to trigger/persist it; on-ingestion mode
  hooks the existing voice webhook path. New dependency: a LangChain multi-vendor LLM client
  (mirrors Mikro/the Fonoster autopilot: `google` / `openai` / `anthropic`).
- **`mods/webapp`**: the gestión detail panel triggers on-demand generation and renders
  generating/loaded states (the analysis section already exists).
- **Per-channel implications**:
  - **Voz IA** — has a transcript → full analysis (summary, sentiment, debt reason, result,
    next step). Primary target of this change.
  - **Pre-grabada** — one-way (a recording is _played_; no customer response captured) → no
    LLM; keeps the generic insight.
  - **SMS** — one-way (no reply captured) → no LLM; keeps the generic insight.
  - **Email** — one-way (no reply captured) → no LLM; keeps the generic insight.
  - Channels are eligible for analysis only when they carry a transcript; today that is Voz
    IA alone. Two-way SMS/Email or answered-and-transcribed pre-recorded calls would become
    eligible automatically if those transcripts are captured later.
- **Privacy/security**: generating analysis sends transcript text (PII) to an external LLM
  provider — gated by `ai.enabled` and provider choice, and disable-able. Related follow-up:
  the Voz IA webhook (`POST /api/voice/events`) is still unauthenticated and must be secured.
