## Why

Operators can author agent templates for five channels (VOICE_AI, VOICE_PRERECORDED, SMS,
EMAIL, WHATSAPP), but there is no way to see how an agent will actually behave before it goes
live. Today the only feedback loop is creating the template, running real outreach, and
inspecting outcomes after the fact — expensive, slow, and irreversible for a conversational
misconfiguration (a bad `systemPrompt`, a broken decision loop). Fonoster already solves this
for its own AUTOPILOT agents; QCobro should reuse that machinery for VOICE_AI rather than
build an eval engine from zero, and needs an equivalent path for the channels Fonoster has no
concept of (EMAIL, WHATSAPP), plus a fast render-only preview for the channels that have no
conversation at all (SMS, VOICE_PRERECORDED). Implements
[fonoster/qcobro#11](https://github.com/fonoster/qcobro/issues/11).

## What Changes

- **New `client.agentEvaluations` SDK resource** — starts a streaming evaluation run against
  either an existing agent template (`{ agentTemplateId }`) or an agent defined in YAML prior
  to creation (`{ yaml }`, parsed against the existing `createAgentTemplateSchema`
  discriminated union into an ephemeral, non-persisted agent). Applies to `VOICE_AI`, `EMAIL`,
  and `WHATSAPP` only — the three channel types with an actual conversation/decision loop to
  evaluate.
- **Evaluation events stream incrementally** over the existing WebSocket-based tRPC
  subscription transport (the `realtime-streaming` capability already built for the Gestiones
  list) — not a single terminal response. Events cover per-turn results, decision-loop actions,
  scores, and a final pass/fail summary.
- **VOICE_AI evaluation reuses Fonoster's AUTOPILOT eval machinery** via `@fonoster/sdk`,
  mirroring the existing VOICE_AI → AUTOPILOT sync path (`sdk-agent-templates`).
- **EMAIL and WHATSAPP evaluation drives the bidirectional autopilot decision loop**
  (`reply` / `ignore` / `resolve` / `escalate`) against scripted inbound replies, reusing the
  existing outcome/`PaymentPromise` capture path (`email-channel`) rather than a separate
  engine. WHATSAPP reuses this exact same mechanism unmodified — its agent config already
  carries the same `systemPrompt`/`maxReplies` shape as EMAIL.
- **New `client.agentTemplates.preview` method** for the two channels with no conversation to
  evaluate — `SMS` and `VOICE_PRERECORDED`. Synchronously renders the message body or TTS
  script against a sample account context and returns the rendered text; no APIServer
  streaming, no Fonoster involvement, no scoring. Accepts the same two targets (existing
  template by id, or YAML prior to creation).
- **Client-side Zod validation** for every new input, throwing `ValidationError` before any
  request is sent, mirroring the existing `AgentTemplatesResource` pattern
  (`mods/sdk/src/resources/agentTemplates.ts`).
- Documented under the SDK section, sibling to `sdk/overview`.
- No implementation in this change — proposal and specs only.

## Capabilities

### New Capabilities

- `agent-evaluations`: streaming, scored/decision-loop evaluation of `VOICE_AI`, `EMAIL`, and
  `WHATSAPP` agents — against an existing template or an ephemeral YAML-defined one — exposed
  as `client.agentEvaluations` in the SDK and run/streamed by the apiserver. Deliberately named
  apart from the unrelated `engine-scorecard` capability's `evaluate(events, parameters)`
  (engine safety/performance/liveness invariants over a dispatch event stream) to avoid
  conflating two unrelated meanings of "evaluate."

### Modified Capabilities

- `sdk-agent-templates`: adds a `preview` method to `client.agentTemplates` for `SMS` and
  `VOICE_PRERECORDED` templates (render-only, no conversation). The resource's existing code
  comment noting "QCobro has no such [conversational-intelligence evaluation] feature today"
  is now stale for the other three channel types and is removed as part of implementation.
- `ctl`: `qcobro agents:eval` currently wraps `client.agentTemplates.sync` (a Fonoster
  re-sync, not a conversation eval) and its own spec text carries the same now-stale "no
  conversational-intelligence evaluation" disclaimer. That command is renamed to
  `agents:sync` (matching what it actually does) so `agents:eval` is free to wrap the real
  `client.agentEvaluations.evaluate`; a new `agents:preview` command wraps
  `client.agentTemplates.preview`.

## Impact

- **`mods/sdk`**: new `resources/agentEvaluations.ts` (streaming) and a `preview` method added
  to `resources/agentTemplates.ts`; new schemas in `@qcobro/common`.
- **`mods/common`**: new Zod schemas for evaluation inputs (target selection, scripted inbound
  replies) and evaluation event/result shapes shared between apiserver and SDK.
- **`mods/apiserver`**: new tRPC procedures — a subscription for streaming evaluation events
  (VOICE_AI/EMAIL/WHATSAPP) over the existing WebSocket transport, and a query for the
  render-only preview (SMS/VOICE_PRERECORDED); a Fonoster AUTOPILOT eval client for VOICE_AI;
  an EMAIL/WHATSAPP autopilot decision-loop runner driven by scripted replies instead of live
  webhooks.
- **`@fonoster/sdk`**: new dependency surface (eval machinery) reused for VOICE_AI.
- **`mods/ctl`**: rename `commands/agents/eval.ts` (sync-wrapper) to `commands/agents/sync.ts`;
  add new `commands/agents/eval.ts` (real evaluation, streaming) and
  `commands/agents/preview.ts`.
- **Docs**: new SDK page for `agentEvaluations`/`agentTemplates.preview`, sibling to
  `sdk/overview`; ctl help text updated to match.
