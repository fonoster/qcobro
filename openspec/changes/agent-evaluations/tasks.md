## 1. Schemas (`@qcobro/common`)

- [x] 1.1 Add the eval-template schema: `createAgentTemplateSchema`'s fields plus a `scenarios`
      array; add the discriminated evaluation-target schema (`{ agentTemplateId, scenarios }` |
      `{ yaml }`, the latter embedding its own scenarios) shared by `agentEvaluations.evaluate`
- [x] 1.2 Add the scenario/turn schema shared across channels: account context (the
      `buildOutreachContext` shape) + ordered turns, each with an input and an optional
      `expected` — `{ text: { type: EXACT|SIMILAR, response } }` and/or `{ tools }` for
      VOICE_AI, `{ action?, outcome? }` for EMAIL/WHATSAPP
- [x] 1.3 Add evaluation event schemas (per-turn `stepResult`-shaped event with `passed`, and
      the apiserver-computed terminal summary event) and result types
- [x] 1.4 Add `preview` input/output schemas (`{ agentTemplateId | yaml, account }` -> rendered
      string), restricted to `SMS`/`VOICE_PRERECORDED`

## 2. Fonoster AUTOPILOT eval integration (VOICE_AI)

- [x] 2.1 Build the adapter that maps a QCobro `VOICE_AI` agent (existing or ephemeral
      YAML-defined) plus its scenarios into an `Applications.evaluateIntelligence` request —
      reusing `FonosterVoiceApplicationClient.buildRequest`'s `intelligence.config` assembly
      (systemPrompt, firstMessage, languageModel, conversationSettings) and translating each
      scenario's account context into Fonoster's `metadata` bag and turns into
      `testCases.scenarios[].conversation`
- [x] 2.2 Relay Fonoster's `stepResult`/`scenarioSummary`/`evalError` stream as this
      capability's evaluation events (no `ref`/prior sync needed for either target — confirmed
      via `@fonoster/types`, not assumed)
- [x] 2.3 Aggregate Fonoster's per-scenario `overallPassed` summaries into one run-level
      terminal summary event (Fonoster itself emits no run-level event)

## 3. EMAIL/WHATSAPP autopilot decision-loop eval runner

- [x] 3.1 Extract/reuse the existing EMAIL autopilot decision-loop function so it can be driven
      by a scripted turn instead of a live correlated webhook
- [x] 3.2 Run the decision loop turn-by-turn over a scenario, accumulating thread state exactly
      as the live path does, without writing any gestión
- [x] 3.3 Grade each turn against its optional `expected.action`/`expected.outcome`, reporting
      `passed`/`failed` per turn (turns with no `expected` stream a result but grade nothing)
- [x] 3.4 Enforce the same `maxReplies` cap semantics as the live channel during a scripted run
- [x] 3.5 Confirm WHATSAPP requires no path-specific changes beyond EMAIL (per design.md); add a
      test proving both channel types share the runner unmodified
- [x] 3.6 Ensure captured outcome/`PaymentPromise` results are returned only in the evaluation
      event, never persisted
- [x] 3.7 Compute one run-level terminal summary event from all scenarios' turn verdicts,
      matching the aggregation contract used for VOICE_AI (Section 2.3)

## 4. Ephemeral YAML agent construction

- [x] 4.1 Parse and validate a YAML eval template's agent fields against
      `createAgentTemplateSchema`, and its `scenarios` against the schema from 1.2
- [x] 4.2 Build an in-memory, non-persisted agent representation from the validated definition
      for each of VOICE_AI, EMAIL, WHATSAPP
- [x] 4.3 Verify no `AgentTemplate` row, Fonoster app, or other workspace side effect is created
      by an ephemeral evaluation run — structurally true (the YAML path never touches
      `client.agentTemplate` at all) and covered by `resolveEvalTarget.test.ts`

## 5. Streaming transport (apiserver)

- [x] 5.1 Add an `agentEvaluations.evaluate` tRPC subscription procedure over the existing
      WebSocket transport (`realtime-streaming`), workspace-scoped like existing subscriptions
- [x] 5.2 Wire VOICE_AI (Section 2) and EMAIL/WHATSAPP (Section 3) runners to emit events onto
      this subscription as the run progresses
- [x] 5.3 Emit exactly one terminal summary event per run (pass/fail verdict) and close the
      stream
- [x] 5.4 Add an `agentTemplates.preview` tRPC query (synchronous, no subscription) for
      SMS/VOICE_PRERECORDED rendering

## 6. SDK (`mods/sdk`)

- [x] 6.0 (Found during implementation, not in the original plan) Add WebSocket transport to
      the `Client` itself: `createWSClient`/`splitLink`/`wsLink`, mirroring the webapp's
      `lib/trpc.ts` split exactly (`connectionParams` carrying token+workspace). Previously
      only the webapp had WS wiring — the SDK/CLI had no way to consume any subscription,
      which `agentEvaluations.evaluate` needs. `ClientOptions.WebSocket` mirrors the existing
      `fetch` override for older runtimes.
- [x] 6.1 Add `resources/agentEvaluations.ts` (`AgentEvaluationsResource`) mirroring the
      `parse`/`RequestRunner` pattern in `resources/agentTemplates.ts`; `evaluate` adapts
      tRPC's callback-based `.subscribe` into an async generator so callers `for await` it
- [x] 6.2 Add `preview` method to `resources/agentTemplates.ts`
- [x] 6.3 Wire `client.agentEvaluations` onto the `Client`
- [x] 6.4 Remove the now-stale "QCobro has no such [conversational-intelligence evaluation]
      feature today" code comment in `resources/agentTemplates.ts` (replaced with a pointer to
      `agentEvaluations.evaluate`/`preview`)

## 7. CLI (`mods/ctl`)

- [x] 7.1 Rename `commands/agents/eval.ts` (the `client.agentTemplates.sync` wrapper) to
      `commands/agents/sync.ts`; update its command id, help text, and examples accordingly
- [x] 7.2 Add a new `commands/agents/eval.ts` wrapping `client.agentEvaluations.evaluate`,
      accepting `--template-id --scenarios <file>` or `--file <evalTemplate.yaml>`, printing
      each streamed turn result and a final pass/fail summary, exiting non-zero on failure
- [x] 7.3 Add `commands/agents/preview.ts` wrapping `client.agentTemplates.preview`, accepting
      `--template-id`/`--file` plus `--account <file>`

## 8. Tests

- [x] 8.1 Unit tests: schema validation rejects malformed evaluation-target/scenario/preview
      inputs client-side (no request sent) — `mods/sdk/src/agentEvaluations.test.ts` +
      additions to `agentTemplates.test.ts`
- [x] 8.2 Unit tests: EMAIL/WHATSAPP decision-loop eval runner against scripted scenarios
      (promise captured, cap reached, resolve/escalate stop the loop, unmet `expected.action`/
      `expected.outcome` reports `passed: false` rather than being silently accepted) —
      `runAutopilotEvaluation.test.ts` (also covers VOICE_AI's own grading in
      `runVoiceAiEvaluation.test.ts`, and target resolution/rejection in
      `resolveEvalTarget.test.ts`)
- [x] 8.3 Unit tests: preview rejects VOICE_AI/EMAIL/WHATSAPP targets; renders SMS/
      VOICE_PRERECORDED correctly for both existing-template and YAML targets —
      `previewAgentTemplate.test.ts`
- [x] 8.4 Integration test: an evaluation run against an existing template produces no gestión,
      no `PaymentPromise` row, and no real dispatch — covered at the unit level (the
      `EvalAgentTemplateClient`/`EmailAutopilot` ports the runners depend on have no write
      method to call at all, and `runAutopilotEvaluation.test.ts` asserts a captured outcome
      only ever appears in the returned event); no full apiserver+DB integration harness run
- [ ] 8.5 Integration test: streamed events arrive incrementally (not batched into one terminal
      response) over the WebSocket transport — **not done**; would need a real `ws`
      WebSocketServer + `applyWSSHandler` + SDK `Client` end-to-end, deferred as a fast-follow
- [ ] 8.6 Test: renamed `agents:sync` still behaves exactly as the old `agents:eval` did; new
      `agents:eval`/`agents:preview` cover both existing-template and YAML/file targets —
      **not done**; `mods/ctl` has no existing test scaffolding for `agents:*` commands to
      extend, deferred as a fast-follow

## 9. Docs

- [x] 9.1 Add an SDK docs page for `agentEvaluations`/`agentTemplates.preview`, sibling to
      `sdk/overview` — `docs-site/sdk/agent-evaluations.mdx`, wired into `docs.json`'s SDK
      nav group; written via `/ps:docs` (checkpoint at `.claude/docs/agent-evaluations.md`)
- [x] 9.2 Document the scripted-reply scenario format for EMAIL/WHATSAPP evaluation —
      "Da forma a los escenarios" section on the new page (`expected.action`/`.outcome` vs
      VOICE_AI's `expected.text`/`.tools`)
- [x] 9.3 Update ctl help/docs for the renamed `agents:sync` and new `agents:eval`/
      `agents:preview` commands — `docs-site/cli/overview.mdx`'s "Agentes" section rewritten,
      stale "no conversational evaluation" disclaimer removed; `sdk/reference.mdx` also
      updated with the new exports

## 10. Judge-based SIMILAR grading for EMAIL/WHATSAPP (post-ship addition, 2026-08-24)

Resolves the deferred judge-grading open question — see design.md's "Post-ship revision"
section. Prompted by a real hallucinated-bank-account incident.

- [x] 10.1 Add the `TextSimilarityJudge` port (`mods/common/src/types/evalJudge.ts`):
      `compare({expected, actual, context}) -> {passed, reason?}`
- [x] 10.2 Add the production adapter (`mods/apiserver/src/services/textSimilarityJudge.ts`),
      mirroring `insightGenerator.ts`'s provider-abstracted shape (`mock` offline heuristic +
      `google` REST, `openai`/`anthropic` not yet implemented) — an entity-faithful prompt,
      not Fonoster's intent-only one (see design.md)
- [x] 10.3 Wire the judge into the tRPC context (`trpc/context.ts`) and thread it through
      `createEvaluateAgent` -> `runAutopilotEvaluation`, replacing the placeholder
      substring-match `SIMILAR` grading; `EXACT` unchanged (literal match, never judged)
- [x] 10.4 Ground the judge's grounding context in the scenario's already-rendered account
      context (`buildSyntheticAccountContext`'s output) so a reply correctly citing real
      account data isn't flagged as hallucination
- [x] 10.5 Populate `errorMessage` on a failing turn (action/resultado mismatch, EXACT
      mismatch, or the judge's `reason`) — previously computed but never surfaced; update
      `agents:eval`'s CLI output to print it under the turn line
- [x] 10.6 Unit tests: judge port stub in `runAutopilotEvaluation.test.ts` (EXACT never calls
      the judge, SIMILAR defers to it and surfaces its `reason` on failure, account context is
      passed through); `textSimilarityJudge.test.ts` for the mock-fallback and
      unimplemented-provider paths
- [x] 10.7 Author the concrete scenario reproducing the hallucinated-bank-account incident —
      `evals/email-hallucinated-payment-info.yaml` (customer/lender/bank details redacted to
      fakes). Two scenarios: the actual incident (agent asked for account info must redirect
      to WhatsApp, not invent bank details) and a control (citing the real context-provided
      balance must NOT be flagged as hallucination). Schema-validated and smoke-run end to end
      against the real judge wiring (mock provider, since no LLM key is configured in this
      sandbox — confirms no crash and correct event shape; judge quality itself needs a real
      `google` provider run, which only the user can do)
- [ ] 10.8 Docs: `docs-site/sdk/agent-evaluations.mdx`'s scenario-format section and
      `sdk/reference.mdx` still describe EMAIL/WHATSAPP `expected.text` as it stood before this
      addition (and still use the stale `.outcome` field name predating the `resultado`
      rename) — **not done**, deferred; report generation (JSON/Markdown/PDF) explicitly
      lower priority, not started
- [x] 10.9 Manually validated against a real `google` provider (gemini-2.5-flash) — the risk
      10.7 flagged as untested. Ran the actual (redacted) production system prompt for an
      EMAIL "mora temprana" agent through the shipped regression scenario plus an ad hoc
      battery of legitimate/adversarial scenarios (balance/payment-date questions, discount
      requests, prompt-injection attempts, hostile customers, fake-authority data requests).
      The bank-account hallucination was reproduced and caught by the judge every run; real
      account data was never false-flagged. One judge false positive found and fixed: see
      design.md's "Follow-up: broaden judge grounding" and the new spec scenario above —
      `context` now also carries `referenceDate` and `customerMessage`
      (`runAutopilotEvaluation.ts`, `runAutopilotEvaluation.test.ts`)
