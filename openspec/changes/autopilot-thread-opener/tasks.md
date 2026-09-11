## 1. Shared contract

- [x] 1.1 Add `buildThreadWithOpener(channelData, messages)` in
      `mods/common/src/utils/threads.ts`, documenting why the opener is assembled at the point of
      use rather than persisted
- [x] 1.2 Named re-export from `mods/common/src/utils/index.ts`
- [x] 1.3 Widen `EvalAgentTemplateRow.emailConfig` with `subject` — Prisma already returns it; the
      TS type was narrower than the row

## 2. Give the autopilot the opener

- [x] 2.1 `functions/email/ingestEmailReply.ts` — pass `buildThreadWithOpener(existing, …)` to
      `autopilot.decide`; leave the persisted `emailThread` untouched
- [x] 2.2 Same in `functions/whatsApp/ingestWhatsAppMessage.ts`
- [x] 2.3 `services/emailAutopilot.ts` — render a message's `subject` in the prompt when it has
      one; previously only `body` was rendered, so a stored subject still would not have reached
      the model
- [x] 2.4 `functions/email/ingestEmailReply.ts` — fall back to the notice's subject for the
      agent's `Re:` line, replacing the `thread.messages[0]?.subject` fallback that resolved to the
      first _inbound_ message

## 3. Stop dropping the subject at dispatch

- [x] 3.1 `engine/engine.ts` — persist `subject: result.renderedSubject` on the gestión's
      `channelData`, matching the manual dispatch path

## 4. One definition of the conversation

- [x] 4.1 `functions/voice/generateGestionInsight.ts` — replace its hand-rolled opener prepend with
      the shared helper, so an insight and a reply are never built from different views

## 5. Adjacent WhatsApp fix

- [x] 5.1 Pass `referenceDate` to `decide` in `ingestWhatsAppMessage.ts` — EMAIL always has; without
      it a relative promise cannot resolve to a dated `PaymentPromise`
- [x] 5.2 Read it in `services/whatsAppAutopilot.ts`'s `buildPrompt`, with the same two date lines
      EMAIL carries. 5.1 alone was inert: the field reached `decide` and the prompt builder never
      looked at it, so "el viernes" still had no anchor and `dueDate` (a bare `z.string()`) would
      have persisted the raw phrase onto a `PaymentPromise`

## 6. Make evals faithful

- [x] 6.1 `resolveEvalTarget.ts` — carry `openerBody`/`openerSubject` on the EMAIL/WHATSAPP
      `ResolvedEvalAgent`, from both the stored-row and YAML-template paths
- [x] 6.2 `runAutopilotEvaluation.ts` — seed the thread with that opener rendered against the
      scenario's synthetic account, via the same shared helper

## 7. Tests

- [x] 7.1 `mods/common/src/utils/threads.test.ts` — opener present/absent, subject carried, non-string
      fields tolerated, input not mutated
- [x] 7.2 `ingestEmailReply.test.ts` — a dispatch-shaped fixture (flat `channelData`, no thread);
      assert the opener leads the decision thread, is **not** persisted, and supplies the reply subject
- [x] 7.3 `ingestEmailReply.test.ts` — continuity across three inbound replies: the opener stays at
      index 0 and no earlier turn is dropped as the thread grows
- [x] 7.4 `ingestWhatsAppMessage.test.ts` — same, plus `referenceDate`
- [x] 7.5 `runAutopilotEvaluation.test.ts` — the notice is rendered against the scenario account and
      stays first across turns
- [x] 7.6 `resolveEvalTarget.test.ts` — the opener fields are carried off a stored row
- [x] 7.7 `email.integration.test.ts` — the rendered subject and body are recorded at dispatch
- [x] 7.8 `whatsAppAutopilot.test.ts` — assert on the **prompt text sent to the model**, for both
      channels, not on the request handed to `decide`. Asserting the request is what let 5.1 ship
      inert: it passed while the prompt builder ignored the field. Verified by reverting the fix
      and watching the new test fail

## 8. Verify

- [x] 8.1 `npm test --workspace=mods/common` and `npm test --workspace=mods/apiserver`
- [ ] 8.2 Live round trip: `engine:sim`, then `email:smoke-reply -- --text="¿De qué trata esto?"` —
      today the agent cannot answer it
- [ ] 8.3 Re-run the eval suite and triage failures. Scenario expectations were authored against an
      agent that could not see the opener, so some may now be wrong in the other direction
      (see design.md). Use the direct-pipeline tsx script, not `agents:eval` over `/trpc-ws`
