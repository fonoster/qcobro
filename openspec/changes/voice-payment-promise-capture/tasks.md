## 1. Voice decision service

- [ ] 1.1 Add `mods/apiserver/src/services/voiceAutopilot.ts`, mirroring `emailAutopilot.ts`/
      `whatsAppAutopilot.ts`: `buildPrompt` (transcript-based, describes a finished call,
      constrains `action` to `ignore | resolve | escalate`, asks for `outcome`/`objective`
      with the same `referenceDate` relative-date instruction), `parseDecision` (reuse
      `emailAutopilotDecisionSchema`), `mockDecide` (deterministic regex fallback over the
      customer's transcript lines), `googleDecide`, `createVoiceAutopilot(ai): EmailAutopilot`.
- [ ] 1.2 Add a transcript→thread mapper (`role: "customer" → direction: "inbound"`,
      `"agent" → "outbound"`) so `buildPrompt` can reuse `EmailAutopilotRequest.thread`
      unchanged — inverse of the mapping `generateGestionInsight.ts`'s `buildTranscript`
      already does for email.
- [ ] 1.3 Unit tests for `voiceAutopilot.ts`: mock-provider payment/non-payment/escalate
      cases, `parseDecision` fenced/unfenced JSON, empty-transcript handling.

## 2. Context loading

- [ ] 2.1 Add a `VoiceGestionView`-shaped Prisma loader (new file or alongside
      `voiceEvents.ts`) that, given a gestión id, returns: `portfolioAccountId`, `campaignId`,
      `debtAmountSnapshot`, `providerRef`, `channelData` (for the transcript),
      `agentSystemPrompt`, and `accountContext` (`buildOutreachContext`).
- [ ] 2.2 Resolve `agentSystemPrompt` via `log.campaign?.agentTemplate?.voiceAiConfig` when a
      campaign is attached, else `agentTemplate.findUnique({ where: { id: log.agentTemplateId
    } }, { include: { voiceAiConfig: true } })` for ad-hoc/follow-up dispatches — same
      dual-path pattern already implemented in `whatsAppWebhook.ts`.
- [ ] 2.3 Reuse (don't duplicate) `generateGestionInsight.ts`'s `buildTranscript`/transcript
      extraction from `channelData`, or extract it to a shared helper if reuse isn't
      straightforward from `voiceEvents.ts`'s current module boundaries.

## 3. Wire the decision into conversation.ended

- [ ] 3.1 In `voiceEvents.ts`, after `ingest(req.body)` succeeds, `result.matched`, and
      `event.eventType === "conversation.ended"`: load context (task 2.1), skip with no-op if
      transcript is empty (mirrors the `no_transcript` guard in `generateGestionInsight`),
      else call `voiceAutopilot.decide(...)`.
- [ ] 3.2 When the decision carries an `outcome`, call `recordOutcome` with
      `agentType: "VOICE_AI"`, `providerRef: event.callRef`, `intentMetadata` from
      `decision.objective` (`amount`/`dueDate`), same shape `ingestEmailReply`/
      `ingestWhatsAppMessage` already pass.
- [ ] 3.3 Run this step after `res.status(200).json(...)` (best-effort, matches the existing
      insight-generation and billing-settlement posture in this handler) — wrap in try/catch
      so a decision failure only logs and never surfaces as a webhook error.
- [ ] 3.4 Add `ai: AiConfig` and a `recordOutcome` function to `VoiceEventsDeps`; run the
      decision step unconditionally when `ai` is configured (mock fallback when absent),
      independent of the existing `generation` ("onIngestion"/"onDemand") flag, per design.md.

## 4. Bootstrap wiring

- [ ] 4.1 In `mods/apiserver/src/index.ts`, pass `ai: config.ai` and
      `recordOutcome: createRecordOutcome(prisma as never)` into `createVoiceEventsHandler`'s
      deps, alongside the existing `generator`/`generation`/`recordEvent`/`settleUsage`.

## 5. Tests

- [ ] 5.1 `voiceEvents.ts` handler tests: payment-promise captured on `conversation.ended`
      with a promise-shaped transcript → `PaymentPromise` created; non-payment outcome →
      outcome recorded, no `PaymentPromise`; empty transcript → no decision made; decision
      throws → event still accepted, transcript/recording/duration still persisted, billing
      settlement still runs.
- [ ] 5.2 Idempotency test: redelivering the same `conversation.ended` event twice (both
      producing a `PAYMENT_PROMISE` decision) results in exactly one `PaymentPromise`.
- [ ] 5.3 Ad-hoc/follow-up dispatch test: a Voz IA gestión with `campaignId` null and a direct
      `agentTemplateId` still resolves `agentSystemPrompt` and captures a promise correctly.

## 6. Verification

- [ ] 6.1 `npm run typecheck` (apiserver + common) and `npm test` (apiserver) pass.
- [ ] 6.2 Manual smoke: run the app, dispatch a Voz IA call in mock/offline AI mode, send a
      synthetic `conversation.ended` with a payment-promise transcript, confirm a
      `PaymentPromise` appears on the operator worklist.
