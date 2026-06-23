## Context

The Voz IA gestión detail already shows an "Análisis IA" section, but it renders
"pendiente" because nothing fills the analysis fields. The data is in place:

- `AccountContactLog` has `aiSummary`, `aiSentiment`, `aiDebtReason`, `aiResult`,
  `aiNextStep`, plus `channelData.transcript` (normalized `{role, text}[]`) and
  `recordingUrl` written by the `conversation.ended` webhook (`ingestVoiceEvent`).
- One-way channels (SMS, Pre-grabada, Email) already show a **generic per-channel insight**
  via i18n (`gestiones.insight.*`) — no LLM, because they capture no customer response.

The codebase has an established framework reference for LLMs: Mikro (`mods/agents`) and the
Fonoster autopilot both use **LangChain** with a small multi-vendor factory
(`createChatModel({ vendor, apiKey, model })`, vendors `google` | `openai` | `anthropic`),
and the autopilot's own conversation model is `gemini-2.5-flash`. Deployment configuration
lives in `qcobro.json` (validated by `qcobroConfigSchema`), with optional `fonoster`/`twilio`
sections that fail closed when absent — the pattern this `ai` section follows.

This change is **proposal/spec only**; no code is written here.

## Goals / Non-Goals

**Goals:**

- Produce the structured `ai*` analysis for gestiones **that have a transcript**, from that
  transcript, in the call's language.
- Make it configurable and disable-able via `qcobro.json` (`ai` section), defaulting to
  **off** when the section is absent.
- Minimize cost: by default, only analyze gestiones an operator actually opens, and persist
  the result so it is computed at most once per gestión.
- Reuse the existing `ai*` fields and detail UI; keep one-way channels exactly as they are.

**Non-Goals:**

- No analysis for one-way channels (no transcript to analyze). Their generic insight stands.
- No auto-setting of `outcome` or auto-creating `Objective`s from the analysis (that stays
  with the manual/intent flow). The analysis is advisory text only.
- No batch/backfill job, no streaming, no fine-tuning, no eval harness in this change.
- No change to the webhook's authentication posture (tracked separately).

## Decisions

### 1. An injectable LLM "insight" port, LangChain multi-vendor — mirroring Mikro/autopilot

A validated function `generateGestionInsight` takes an injected `InsightGenerator` port
(`analyze(transcript, context) -> structured analysis`) plus Prisma, following the repo's
validated-function + DI pattern (testable with a stub, no live LLM in unit tests). The
production adapter builds a request from the `ai` config and calls the vendor over its
**REST API** (no SDK dependency), keeping the multi-vendor shape Mikro/the autopilot use
without adding heavy LangChain packages. A built-in **`mock` provider** synthesizes a
deterministic analysis offline for dev/demos/tests. **Why:** vendor portability +
unit-testability with the lightest dependency footprint and a free offline path.
**Implemented now:** `mock` and `google` (Gemini REST); `openai`/`anthropic` are config-valid
but their REST adapters are a follow-up. **Alternative considered:** LangChain multi-vendor
SDKs (as in Mikro) — deferred to avoid three heavy provider packages for one call site.

### 2. `qcobro.json` `ai` section (optional, fails closed)

```jsonc
"ai": {
  "enabled": true,
  "provider": "google",            // google | openai | anthropic
  "apiKey": "…",
  "model": "gemini-2.5-flash",     // default; validated per provider
  "temperature": 0,
  "maxTokens": 600,
  "generation": "onDemand"          // onDemand (default) | onIngestion
}
```

Absent or `enabled:false` → no LLM is ever called; the detail shows "pendiente" and one-way
insights are unaffected. **Why:** matches the optional `fonoster`/`twilio` posture and the
"config via qcobro.json" convention. Default model `gemini-2.5-flash` matches the autopilot.

### 3. Generation timing: `onDemand` default, `onIngestion` optional — with persistence

- **onDemand (default):** when the operator opens a gestión that **has a transcript** and
  **no analysis yet**, the console calls a workspace-scoped procedure that generates the
  analysis, **persists** it to the `ai*` fields, and returns it. Subsequent opens read the
  cached fields — no second LLM call.
- **onIngestion:** the `conversation.ended` webhook path generates the analysis inline when
  it stores the transcript.

**Why default onDemand:** most gestiones are never opened; paying per completed call is
wasteful at scale. On-demand pays only for reviewed calls and still results in a one-time
cost (persisted). **Alternative — always at ingestion:** simplest and warms every record,
but costs the most; offered as a config option for deployments that want it.

**Cache key:** presence of `aiSummary` marks a gestión analyzed; a gestión with a transcript
and a null `aiSummary` is eligible. (A dedicated `aiAnalyzedAt` marker is a clean refinement
if we later need to distinguish "analyzed, empty result" — noted, not required now.)

### 4. Channel gating: transcript-only

Analysis runs iff the gestión has a non-empty `channelData.transcript`. Today that is **Voz
IA** only. SMS/Pre-grabada/Email have no captured response, so they are never analyzed and
keep their generic insight. **Why:** there is nothing to analyze without a conversation;
gating on the transcript (not the channel enum) means new transcript sources light up
automatically.

### 5. Structured, validated, multilingual output

The model is prompted to return JSON for the `ai*` fields: `aiSummary` (short paragraph),
`aiSentiment` ∈ `POSITIVE|NEUTRAL|NEGATIVE|HOSTILE`, `aiDebtReason`, `aiResult`, `aiNextStep`
— **written in the call's language** (derived from the account's `preferredLanguage` /
agent language). The result is Zod-validated; on parse failure or provider error the gestión
is left unanalyzed (stays "pendiente"), never written with garbage. **Why:** the detail card
binds these exact fields; sentiment must match the existing enum/badges.

### 6. Where it runs

`generateGestionInsight` (apiserver `functions/voice/` or `functions/insights/`) +
a `campaigns.contactLog.generateInsight` workspace-scoped tRPC mutation the panel calls on
open. `onIngestion` reuses the same function from the webhook path. **Why:** keeps the
console thin and the LLM call server-side (keys never reach the browser).

## Risks / Trade-offs

- **PII egress** → transcripts go to an external LLM. Mitigation: feature is opt-in
  (`ai.enabled`), provider is configurable, and it can be disabled entirely; document the
  data flow. Self-host/regional providers are a future option.
- **First-open latency (onDemand)** → the operator waits a beat on first view. Mitigation:
  a clear generating state in the panel; result is cached so it is one-time.
- **Concurrent opens double-generate** → two simultaneous first-opens may both call the LLM.
  Mitigation: re-check before write; a duplicate overwrite is harmless. A row-level guard is
  a possible refinement.
- **Model quality / hallucination** → summaries could be wrong. Mitigation: low temperature,
  strict schema, advisory-only (never auto-acts on outcome/objectives); operator sees the
  transcript alongside.
- **Provider outage / quota** → generation fails. Mitigation: fail soft (leave "pendiente",
  retry on next open); optional fallback vendor is a refinement (the autopilot config has a
  fallback model precedent).
- **Webhook still unauthenticated** → unrelated to this change but in the same area; an
  attacker could seed a transcript that later gets analyzed. Tracked as its own follow-up.

## Migration Plan

- Additive only: new optional `ai` config + new function/procedure + a webapp trigger. No
  data migration required (reuses existing `ai*` fields; cache marker is `aiSummary`
  presence). Adding `aiAnalyzedAt` later would be a small, optional migration.
- **Rollback:** set `ai.enabled:false` (or remove the `ai` section) — the system reverts to
  showing "pendiente" for Voz IA and generic insights for one-way channels.

## Open Questions

All resolved for this proposal (decisions above), to keep momentum while the author is away:

- Outcome/objective derivation from analysis — **decided out of scope** (advisory only);
  revisit if operators want auto-suggested outcomes.
- `aiAnalyzedAt` marker vs `aiSummary`-presence — **decided** to use `aiSummary` presence now.
- Fallback vendor — **deferred** (single configured provider for now).
