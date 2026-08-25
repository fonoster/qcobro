## Context

Agent templates cover five channels (`agent-templates` spec): `VOICE_AI`, `VOICE_PRERECORDED`,
`SMS`, `EMAIL`, `WHATSAPP`. Three of them run an actual conversation or decision loop
(`VOICE_AI` via Fonoster AUTOPILOT; `EMAIL` and `WHATSAPP` via the bidirectional autopilot
decision loop in `email-channel`/`whatsapp-channel`). The other two are one-shot renders with
nothing to converse with: `SMS` sends a single rendered message body, `VOICE_PRERECORDED`
synthesizes a single fixed script. Today none of the five can be inspected before a real
outreach happens.

The `sdk-agent-templates` spec already flags this gap explicitly: `sync` "is not a
conversational-intelligence evaluation — QCobro has no such feature today." This change fills
that gap for the three conversational channels and adds a cheap render-only preview for the
other two, rather than forcing every channel through one streaming API shaped for the hardest
case.

**Researched against the real Fonoster API** (`@fonoster/types`'s `applications.types.d.ts`,
`@fonoster/sdk`'s `Applications.evaluateIntelligence`, and the `testCases` block already
present in this repo's `mods/apiserver/scripts/assets/autopilot.yaml:143-504`) rather than
guessed. Three things carry over, generalized; several things deliberately do not — see
Decisions.

A separate existing capability, `engine-scorecard`, already owns the word "evaluate" for a
completely different concept: `evaluate(events, parameters)` replays a _dispatch_ event stream
against safety/performance/liveness invariants (rate caps, suppression, error rates). That is
about whether the _engine_ behaved correctly across many accounts over time. This change is
about whether one _agent's conversation logic_ behaves as intended against a scripted scenario,
before or independent of any real dispatch. The two must stay clearly separated in naming and
documentation so "run an eval" is never ambiguous between them.

## Goals / Non-Goals

**Goals:**

- Let a developer evaluate an existing `VOICE_AI`/`EMAIL`/`WHATSAPP` agent template, or one
  defined in YAML before it is ever created, and watch results stream in as the run progresses.
- Reuse Fonoster's AUTOPILOT eval machinery for `VOICE_AI` instead of building a scoring engine.
- Reuse the existing EMAIL autopilot decision loop for both `EMAIL` and `WHATSAPP` evaluation,
  driven by scripted inbound replies instead of live webhooks.
- Give `SMS`/`VOICE_PRERECORDED` a fast, synchronous way to see rendered output against a
  sample account, without pretending they have a conversation to stream.
- Reuse the existing WebSocket tRPC subscription transport (`realtime-streaming`) for the
  streaming parts of this change instead of introducing a second transport.

**Non-Goals:**

- Building a general-purpose conversation simulator or LLM judge from scratch — VOICE_AI eval
  is Fonoster's, not QCobro's, to implement.
- Replacing or touching `engine-scorecard`'s dispatch-invariant evaluation in any way.
- A UI for running evals in the operator console — this change is SDK/APIServer surface only,
  consumed programmatically (per issue #11, "Documented under the SDK section").
- Persisting eval runs as first-class workspace data (contact logs, gestiones) — a run against
  a YAML definition has no workspace-durable side effects; a run against an existing template
  evaluates behavior only, it does not dispatch real outreach or write gestiones.

## Decisions

### An eval template is one document: agent config + its own scenarios, graded per-step

Fonoster's `testCases.scenarios[]` lives embedded inside the same `intelligence.config` block
used to define the agent — one document is both the agent and its tests. QCobro adopts that
shape for all three conversational channels: a YAML eval template is `{ ...agent definition
fields (createAgentTemplateSchema), scenarios: [...] }`, and evaluating an _existing_ template
by id behaves identically except the agent fields come from the stored row instead of the
YAML. Each scenario carries its own account context and an ordered list of turns; **every
turn's `expected` is optional but, when present, is graded and reported as `passed`/`failed`
per Fonoster's `stepResult` pattern** — this replaces the earlier draft where only VOICE_AI
turns had a pass/fail notion and EMAIL/WHATSAPP turns were purely descriptive. For VOICE_AI,
`expected` is `{ text: { type: EXACT | SIMILAR, response } }` and/or `{ tools: [...] }`,
relayed from Fonoster unchanged. For EMAIL/WHATSAPP, the equivalent of an "expected tool call"
is an **expected autopilot action/outcome** (`{ action?, outcome? }`) — the actual correctness
bar for a collections agent is behavioral (did it stop when it should, did it capture the
right promise), not verbatim reply wording — with an optional `expected.text` SIMILAR/EXACT
check on the generated reply for callers who also want that. A scenario with no `expected` on
any turn still runs and streams results; it just has nothing to grade, matching Fonoster's own
behavior when a scenario's steps omit `expected` — **this holds for EMAIL/WHATSAPP only.**

> **Correction (found via live local testing, not assumed):** Fonoster's real
> `evaluateIntelligence` service rejects any VOICE_AI conversation turn whose `expected.text` is
> missing — there is no "ungraded turn" concept on their side, unlike EMAIL/WHATSAPP where
> QCobro's own decision-loop runner does its own grading and can leave a turn's `expected`
> fully absent. `resolveEvalTarget` now rejects a VOICE_AI scenario with any turn missing
> `expected.text` with a clear `ValidationError` before ever calling Fonoster, rather than
> letting the raw 400 from Fonoster's request validation surface. Scenario `description` is
> also a required field on Fonoster's side (defaults to `ref` when the author omits it) — see
> the correction below on `evalsLanguageModel` for the other required field this same live test
> uncovered.

**Alternative considered:** keep the agent definition and the scenario/scenario-account
decoupled as two separate call-time inputs (my initial sketch). Rejected once the reuse
decision above was made — decoupling them abandons the exact "one document" ergonomic that
prompted reusing Fonoster's pattern in the first place, and gains nothing: an eval template is
conceptually a fixture, and fixtures read better as one file.

### What does not transfer from Fonoster's scenario shape

Fonoster's `telephonyContext` (`callDirection`, `ingressNumber`, `callerNumber`) is
voice/telephony plumbing with no EMAIL/WHATSAPP equivalent — dropped entirely. Its flat
`metadata` bag (`customerName`, `loanId`, `principal`, ...) is a thin, demo-specific stand-in
for account data; QCobro already has a canonical account shape (`buildOutreachContext` /
`PortfolioAccountRecord`), so every channel's scenario account context is that shape, not a
reinvented bag — the VOICE_AI runner maps it into Fonoster's `metadata` fields at call time,
the same outward-adaptation pattern QCobro already uses to map its own camelCase fields to
Meta's snake_case WhatsApp template parameters. EMAIL/WHATSAPP's own `expected.text` grading
(if used at all) starts as exact/substring matching, with LLM-judged `SIMILAR` grading left as
a documented future extension rather than something this change commits to building.

> **Correction (found via live local testing, not assumed):** the paragraph originally here
> claimed Fonoster's `testCases.evalsLanguageModel` was an optional, judge-only addition this
> change chose not to adopt for v1. That was wrong — `evalsLanguageModel` is a **required**
> field on every `testCases` object Fonoster's live service accepts, regardless of whether any
> turn uses `SIMILAR` grading; requests without it are rejected outright. It has nothing to do
> with EMAIL/WHATSAPP (which never call Fonoster at all) — it is VOICE_AI-only, and always
> `provider: "openai"` (the only provider Fonoster's evals grader supports, independent of the
> agent's own conversational `llmProvider`/`llmModel`). `FonosterVoiceApplicationClient.evaluate`
> now always sends `evalsLanguageModel: { provider: "openai", model: fonoster.autopilot.evalsModel
}` (new config field, `common/src/config.ts`, defaults to `gpt-4o-mini`). Empirically, Fonoster
> supplies its own default OpenAI key when none is given, so no `apiKey` config field is exposed
> yet — add one if a deployment ever needs its own quota instead of Fonoster's shared default.

### VOICE_AI evaluation is inherently ref-less — no prior sync required

Confirmed directly from the SDK: `Applications.evaluateIntelligence` sends only `{
intelligence: { productRef, config } }` over the wire — no application ref, no requirement
that the application (or even any `fonosterAppRef`) already exists. This resolves the design
risk below about evaluating a YAML-defined VOICE_AI agent with nothing synced yet: the
apiserver builds the `intelligence` config the same way `FonosterVoiceApplicationClient
.buildRequest` already does for `createApplication`/`updateApplication` (systemPrompt,
firstMessage, languageModel, conversationSettings from the Autopilot template), adds the
scenario's `testCases.scenarios` translated from the QCobro-shaped scenario, and calls
`evaluateIntelligence` directly — identically whether the target is an existing template or an
ephemeral YAML one, since neither path ever needs a `ref`.

### QCobro computes the run-level summary; Fonoster only summarizes per scenario

Fonoster's stream ends each scenario with a `scenarioSummary` (`overallPassed`) but has no
run-level terminal event across multiple scenarios. `client.agentEvaluations.evaluate`'s
contract of "exactly one terminal summary event" (see the `agent-evaluations` spec) is
therefore something QCobro's apiserver computes itself — aggregating every scenario's result
(and, for EMAIL/WHATSAPP, every turn's `passed`) into one overall verdict — rather than
something relayed verbatim from the backing provider. This keeps the SDK-facing contract
uniform across all three channels regardless of what the backing engine natively provides.

### One new resource for the three conversational channels, one new method for the two static ones

`client.agentEvaluations.evaluate({ agentTemplateId | yaml, ...scenario })` handles `VOICE_AI`,
`EMAIL`, `WHATSAPP` and streams events. `client.agentTemplates.preview({ agentTemplateId | yaml,
account })` handles `SMS`, `VOICE_PRERECORDED` and returns a rendered string synchronously.
**Alternative considered:** route every channel through the streaming API, with `SMS`/
`VOICE_PRERECORDED` emitting a single event then completing. Rejected — a stream with exactly
one event and no notion of turns, score, or pass/fail is a worse API than a plain synchronous
call, and it would force every SDK consumer to handle a stream just to read one rendered string.

### `agentEvaluations` is a new capability, not folded into `sdk-agent-templates`

The streaming eval surface has its own lifecycle (start run → stream events → terminal
summary), its own event/result schemas, and a dependency on `@fonoster/sdk` that
`sdk-agent-templates` does not otherwise have. `preview`, by contrast, is a thin rendering
helper naturally alongside the other `agentTemplates` methods, so it's added there instead of
to the new capability.

### VOICE_AI, EMAIL, and WHATSAPP share one streaming shape; scoring differs per channel

All three targets stream the same envelope (per-turn/per-reply event, then a final summary
event with an overall pass/fail). What differs is what happens _inside_ a turn: VOICE_AI
delegates to Fonoster's AUTOPILOT eval and relays its scored turns; EMAIL/WHATSAPP run the
existing decision-loop function turn-by-turn against a caller-supplied script of inbound
replies and report the resulting action (`reply`/`ignore`/`resolve`/`escalate`) and any
captured outcome/`PaymentPromise` per turn. WHATSAPP requires no additional design work beyond
EMAIL's — its agent config is already shaped identically (`systemPrompt`, `maxReplies`).

### Evaluating a YAML definition builds an ephemeral, non-persisted agent

The YAML target is parsed and validated against the existing `createAgentTemplateSchema`
discriminated union in `@qcobro/common` (the same schema `agentTemplates.create` validates
against), then held in memory for the duration of the run only. No `AgentTemplate` row, no
Fonoster app, no workspace side effects are created. This lets a developer iterate on a
definition without persisting anything until they're satisfied.

### Found during apply: the SDK itself had no WebSocket transport

`realtime-streaming`'s `/trpc-ws` transport existed on the apiserver, but only the
**webapp's own** tRPC client (`mods/webapp/src/lib/trpc.ts`) was ever wired to consume it —
`@qcobro/sdk`'s `Client` used only `httpBatchLink`. Since `agentEvaluations.evaluate` is the
first subscription any SDK/CLI consumer needs, the `Client` now gets the same
`createWSClient`/`splitLink`/`wsLink` split the webapp already uses, with a `WebSocket`
constructor option mirroring the existing `fetch` override for older Node runtimes. This is
additive to the transport (still the same `/trpc-ws` mount, same auth-via-`connectionParams`
contract) — not a new one — so the "reuse the existing transport" decision below still holds;
it just needed the SDK-side link that nothing had required until now.

### Reuse the existing WebSocket tRPC subscription transport

`realtime-streaming` already provides a workspace-scoped WebSocket transport for
server-pushed tRPC events (used today by the Gestiones list), explicitly built to be reusable
by later screens/consumers. `agentEvaluations.evaluate` is implemented as a new subscription
procedure over that same transport rather than a bespoke SSE/polling mechanism.
**Alternative considered:** a dedicated streaming channel per evaluation run (e.g. SSE).
Rejected — it would duplicate auth/workspace-resolution logic already solved once for
`realtime-streaming`, for no benefit specific to evals.

### Naming avoids collision with `engine-scorecard`

The new capability is `agent-evaluations` (SDK: `client.agentEvaluations`), never just
"evaluate" or "scorecard," and its purpose statement explicitly cross-references
`engine-scorecard` to state they are unrelated. `engine-scorecard`'s `evaluate(events,
parameters)` is untouched by this change.

## Risks / Trade-offs

- **Scripting inbound replies for EMAIL/WHATSAPP eval needs its own input schema** (an ordered
  list of turns, each with an inbound message and an optional expected action/outcome) that
  doesn't yet exist anywhere in the codebase → new schema in `@qcobro/common`, modeled on
  Fonoster's `conversation[].expected` shape but with `expected.action`/`expected.outcome` in
  place of `expected.tools`.
- **WHATSAPP eval piggybacks on EMAIL's decision-loop function** → if that function is ever
  split per-channel for reasons unrelated to eval, this change's assumption that "WHATSAPP eval
  ships free with EMAIL eval" breaks and needs revisiting.
- **Authoring burden of per-step `expected` assertions for EMAIL/WHATSAPP** → unlike VOICE_AI
  (where Fonoster's grading is the whole point), requiring every scenario turn to specify an
  expected action could make writing a scenario tedious. Mitigation: `expected` stays optional
  per turn (matching Fonoster's own behavior) — an author can run a scenario purely to observe
  behavior before committing to assertions.
- **`evalsLanguageModel`-style judge grading was deferred at initial ship, then added** — see
  "Post-ship revision — 2026-08-24" below. EMAIL/WHATSAPP `expected.text.type: SIMILAR` now
  runs QCobro's own entity-faithful judge rather than exact/substring match.

## Open Questions

- Whether evaluation runs should be rate-limited/metered separately from real dispatch quota,
  given they can invoke the same LLM/Fonoster costs without producing real outreach.

## Post-ship revision — 2026-08-24: judge-based SIMILAR grading

Resolves the second open question above and the deferred "judge grading" risk. Prompted by a
real production incident: an EMAIL agent hallucinated a bank account number in a reply. The
shipped exact/substring `SIMILAR` matching (§ "EMAIL and WHATSAPP...") could not express "the
reply's intent is right but it invented a fact" as an assertion at all — it can only compare
strings.

**Researched against the real Fonoster implementation** (`../fonoster`, not guessed):
`mods/autopilot/src/models/evaluations/createTestTextSimilarity.ts` is a genuine LLM-as-judge
(`ChatOpenAI`, temperature 0), and its default prompt (`textSimilaryPrompt.ts`) explicitly
instructs the judge to compare intent "ignoring the actual text content, the entities, and
length of the text." That design is right for VOICE_AI's purpose (tolerate phrasing variance)
but wrong for this incident: an intent-only judge would pass a reply that hallucinates a bank
account, since the invented account number is exactly the kind of "entity" it's told to ignore.

**Decision: QCobro's EMAIL/WHATSAPP judge is entity-faithful, not intent-only, and is its own
prompt/implementation — not a copy of Fonoster's.** It fails whenever the actual reply
introduces a fact/entity/number absent from **both** the expected reply and the scenario's
account context (not just the expected reply alone — a correct reply legitimately cites real
balances/dates/names that a short hand-authored expected reply won't restate verbatim; grounding
against context-only-in-expected would make every correct context-citing reply a false
"hallucination"). `EXACT` is unaffected — still a literal match, never calling the judge.

**Decision: reuse `qcobro.json`'s `ai` config, don't add a new one.** Mirrors
`insightGenerator.ts`'s exact shape (provider-abstracted, `mock` offline + `google` REST, same
`openai`/`anthropic` "not yet implemented" gap) rather than adding `@langchain/openai` (what
Fonoster's implementation uses) — this repo's LLM calls are already plain `fetch`-based with no
langchain dependency, and introducing one for a single judge call would be inconsistent with
every other LLM integration here. Unlike the insight generator, the judge is **not** gated on
`ai.enabled` — that flag governs automatic per-gestión insight generation; an eval run is
always a deliberate, explicit action (CLI/console), so an absent/disabled `ai` config falls back
to an offline heuristic instead of making `SIMILAR` unusable.

No new CLI surface: `agents:eval --template-id --scenarios <file>` already accepted
`expected.text.type: SIMILAR` for EMAIL/WHATSAPP (the schema always allowed it); only the
grading behavior behind it changes. The CLI now also prints a turn's failure `reason` (judge or
exact-mismatch), previously silently dropped.

**Follow-up: broaden judge grounding to `referenceDate` and the customer's own message.**
Manually stress-tested against a real `google` provider run (the risk flagged above as
untested) using the actual production system prompt for an EMAIL "mora temprana" agent
(redacted) plus a battery of legitimate and adversarial scenarios. The core claim held under a
real LLM: the judge caught the incident's bank-account hallucination every run, and never
false-positived on real account data. It did false-positive on one legitimate case not
anticipated by the original design — a multi-turn scenario where the customer proposed a
payment date in relative terms ("el día 15") and the agent's confirmation resolved it to an
absolute date ("15 de septiembre"); the judge had no way to tell that date was grounded
(derived from the customer's own message plus today's date) rather than invented, since neither
was part of its `context`. Fix: `context` passed to the judge now
also carries `referenceDate` (the same reference date `EmailAutopilot.decide` itself is called
with) and `customerMessage` (the current turn's `input`) alongside the rendered account
context — see the updated requirement and new scenario above.
