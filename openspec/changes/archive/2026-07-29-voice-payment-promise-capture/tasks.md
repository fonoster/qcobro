## 1. Voice decision service

- [x] 1.1 Add `mods/apiserver/src/services/voiceAutopilot.ts`, mirroring `emailAutopilot.ts`/
      `whatsAppAutopilot.ts`: `buildPrompt` (transcript-based, describes a finished call,
      constrains `action` to `ignore | resolve | escalate`, asks for `outcome`/`objective`
      with the same `referenceDate` relative-date instruction), `parseDecision` (reuse
      `emailAutopilotDecisionSchema`), `mockDecide` (deterministic regex fallback over the
      customer's transcript lines), `googleDecide`, `createVoiceAutopilot(ai): EmailAutopilot`.
- [x] 1.2 Add a transcript→thread mapper (`role: "customer" → direction: "inbound"`,
      `"agent" → "outbound"`) so `buildPrompt` can reuse `EmailAutopilotRequest.thread`
      unchanged — inverse of the mapping `generateGestionInsight.ts`'s `buildTranscript`
      already does for email.
- [x] 1.3 Unit tests for `voiceAutopilot.ts`: mock-provider payment/non-payment/escalate
      cases, `parseDecision` fenced/unfenced JSON, empty-transcript handling.

## 2. Context loading

- [x] 2.1 Add a `VoiceGestionView`-shaped Prisma loader (new file or alongside
      `voiceEvents.ts`) that, given a gestión id, returns: `portfolioAccountId`, `campaignId`,
      `debtAmountSnapshot`, `providerRef`, `channelData` (for the transcript),
      `agentSystemPrompt`, and `accountContext` (`buildOutreachContext`).
      — `functions/voice/decideVoiceOutcome.ts`: `VoiceDecisionClient`/`VoiceDecisionGestionView` + `createPrismaVoiceDecisionClient`.
- [x] 2.2 Resolve `agentSystemPrompt` via `log.campaign?.agentTemplate?.voiceAiConfig` when a
      campaign is attached, else `agentTemplate.findUnique({ where: { id: log.agentTemplateId
} }, { include: { voiceAiConfig: true } })` for ad-hoc/follow-up dispatches — same
      dual-path pattern already implemented in `whatsAppWebhook.ts`.
- [x] 2.3 Reuse (don't duplicate) `generateGestionInsight.ts`'s `buildTranscript`/transcript
      extraction from `channelData` — exported it and imported into `decideVoiceOutcome.ts`.

## 3. Wire the decision into conversation.ended

- [x] 3.1 In `voiceEvents.ts`, after `ingest(req.body)` succeeds, `result.matched`, and
      `event.eventType === "conversation.ended"`: load context (task 2.1), skip with no-op if
      transcript is empty (mirrors the `no_transcript` guard in `generateGestionInsight`),
      else call `voiceAutopilot.decide(...)`. Implemented inside `createDecideVoiceOutcome`
      (`decideVoiceOutcome.ts`), invoked from `voiceEvents.ts` as `deps.decideOutcome(id)`.
- [x] 3.2 When the decision carries an `outcome`, call `recordOutcome` with
      `agentType: "VOICE_AI"`, `providerRef` (the gestión's own ref), `intentMetadata` from
      `decision.objective` (`amount`/`dueDate`), same shape `ingestEmailReply`/
      `ingestWhatsAppMessage` already pass.
- [x] 3.3 Run this step after `res.status(200).json(...)` (best-effort, matches the existing
      insight-generation and billing-settlement posture in this handler) — `.catch()` logs via
      `logger.error` so a decision failure never surfaces as a webhook error.
- [x] 3.4 Adjusted from the original plan: instead of adding raw `ai`/`recordOutcome` fields to
      `VoiceEventsDeps`, added a single pre-composed `decideOutcome: (id) => Promise<...>` field
      — mirrors the existing `settleUsage` dependency shape in this same file. Composed in
      `index.ts` from `createVoiceAutopilot(config.ai)` (mock fallback when `ai` is
      absent/disabled, same as EMAIL/WhatsApp) + `createRecordOutcome`, independent of the
      `generation` ("onIngestion"/"onDemand") flag, per design.md.

## 4. Bootstrap wiring

- [x] 4.1 In `mods/apiserver/src/index.ts`, wire `decideOutcome: createDecideVoiceOutcome({
  client: createPrismaVoiceDecisionClient(prisma), autopilot: createVoiceAutopilot(config.ai),
  recordOutcome: createRecordOutcome(prisma as never), now: () => new Date() })` into
      `createVoiceEventsHandler`'s deps, alongside the existing
      `generator`/`generation`/`recordEvent`/`settleUsage`.

## 5. Tests

- [x] 5.1 Split across two files, matching the codebase's existing boundary (business logic
      unit-tested via injected fakes; the thin REST layer tested for wiring/timing only):
      `functions/voice/decideVoiceOutcome.test.ts` (payment-promise captured → `recordOutcome`
      called with the right params; non-payment outcome → outcome recorded, no objective;
      unrecognized outcome → defaults to `OTHER`; no outcome → nothing recorded; empty
      transcript → decision skipped, autopilot never called; unknown gestión → `not_found`) and
      `rest/voiceEvents.test.ts` (decision runs on `conversation.ended` for a matched gestión,
      not on `conversation.started`, not when unmatched; a `decideOutcome` failure still
      returns 200 — matches the existing best-effort posture of insight generation/billing
      settlement in this same handler).
- [x] 5.2 Idempotency: NOT re-tested here — `recordOutcomeTx`'s `@@unique([contactLogId])`
      dedup guard is exercised by the existing, channel-agnostic
      `functions/campaigns/recordOutcome.test.ts` ("does not duplicate a PaymentPromise on
      re-delivery"). The voice decision step calls the same `recordOutcome` dependency, so it
      inherits this guarantee for free — per design.md's explicit decision not to add
      call-ref-based dedup of its own.
- [x] 5.3 `createPrismaVoiceDecisionClient` dual-path test added to
      `decideVoiceOutcome.test.ts` (campaign dispatch resolves via
      `campaign.agentTemplate.voiceAiConfig`; ad-hoc/follow-up — `campaignId` null — falls
      back to a direct `agentTemplateId` lookup), faked at the JS call-surface level (`as
  never`), matching how this codebase already casts `prisma` at every wiring call site
      rather than reproducing the full generated `PrismaClient` type in tests (no existing
      test does this for the analogous WhatsApp resolver either).

## 6. Verification

- [x] 6.1 `npm run --workspace mods/common build` (typecheck), `npm run --workspace
  mods/apiserver typecheck`, `eslint` on all touched/new files, and the full test suites —
      all pass: 253/253 `mods/apiserver`, 132/132 `mods/common`.
- [x] 6.2 No Postgres/Docker available in the sandbox for a live end-to-end run (no
      `docker-compose.yml` in the repo to provision one, either) — by user decision, did a
      code-level smoke test instead: the real, production-composed
      `createVoiceEventsHandler` + `createDecideVoiceOutcome` + `createVoiceAutopilot`
      (mock/offline decider, no API key) against a fake in-memory Prisma client. Sent
      `conversation.started` then `conversation.ended` with a transcript containing "Puedo
      pagar el viernes"; confirmed `conversation.ended` persisted transcript/recording/
      duration AND the decision step correctly called `recordOutcome` with
      `outcome: "PAYMENT_PROMISE"`, `agentType: "VOICE_AI"`, and the gestión's own
      `providerRef` (the exact params that create a `PaymentPromise` in
      `recordOutcomeTx`). A live DB smoke test is still worth running on a real dev
      machine before/at rollout.
