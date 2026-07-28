## Context

Email and WhatsApp both capture `PAYMENT_PROMISE` outcomes through an autopilot `decide()`
step that runs on every inbound reply and feeds `recordOutcome` (`ingestEmailReply.ts`,
`ingestWhatsAppMessage.ts`). Voz IA has no equivalent: `voiceEvents.ts`'s
`conversation.ended` handler (`POST /api/voice/events`) only persists transcript/recording/
duration (via `ingestVoiceEvent.ts`) and triggers billing settlement + an advisory AI
insight (`generateGestionInsight.ts`, which explicitly never touches `outcome`/objectives).

The key structural difference driving this design: for Email/WhatsApp, QCobro owns each
conversational turn — every inbound message is a discrete event QCobro receives and must
decide how to respond to. For Voz IA, the live turns belong to Fonoster's autopilot; QCobro
only observes `conversation.started`/`conversation.ended`. There is no "inbound reply" to
hook a decision onto mid-call — the only point at which QCobro sees the full conversation is
after it's over.

Existing precedent to follow rather than reinvent: `whatsAppWebhook.ts` already resolves an
agent's config from either `campaign.agentTemplate` (campaign dispatch) or a direct
`agentTemplateId` lookup (ad-hoc/follow-up dispatch, `campaignId` null) — the same dual path
applies to Voz IA gestiones per the payment-promises follow-up flow.

## Goals / Non-Goals

**Goals:**

- On `conversation.ended`, derive `outcome` + `objective` (payment amount/date) from the full
  transcript and record them through the existing `recordOutcome` path, so a `PaymentPromise`
  is created exactly as it would be for Email/WhatsApp.
- Reuse the existing decision contract (`EmailAutopilotDecision` / `emailAutopilotDecisionSchema`)
  unchanged — no new `@qcobro/common` schema.
- Work in mock/offline mode (no AI key) the same way Email/WhatsApp do, via a deterministic
  regex-based fallback decider, so dev/test and demos don't require a live LLM key.
- Preserve `voiceEvents.ts`'s current best-effort-after-response posture: a decision failure
  must not fail the webhook or affect transcript/recording persistence or billing settlement.

**Non-Goals:**

- No live, mid-call promise capture (e.g. Fonoster Autopilot function-calling back to QCobro
  during the call). This change is post-call analysis of the final transcript only — QCobro
  does not control live turns, and adding that is a materially different integration (its own
  proposal if ever pursued).
- No reply/response generation for voice — `action: "reply"` from the shared schema has no
  meaning once a call has ended; the voice prompt asks only for `ignore | resolve | escalate`
  and any stray `reply` is treated as a no-op (no send attempted).
- No change to `ingestVoiceEvent.ts`'s correlation/persistence responsibility — it stays
  focused on transcript/recording/duration; the decision step is a separate, additional step
  invoked from the REST handler, mirroring how insight generation is already layered on top
  rather than folded in.

## Decisions

### Reuse the Email/WhatsApp decision contract and transcript mapping

`EmailAutopilotRequest.thread` is `EmailThreadMessage[]` (`direction: "inbound" | "outbound"`);
the voice transcript is `TranscriptLine[]` (`role: "customer" | "agent"`).
`generateGestionInsight.ts` already maps `inbound ↔ customer` / `outbound ↔ agent` when
folding an email thread into a transcript for the insight generator — this change does the
inverse mapping (transcript → thread messages) so the same `decide(req: EmailAutopilotRequest)`
signature serves voice. No new request/decision types are introduced.

**Alternative considered**: a distinct `VoiceAutopilotDecision` schema/type. Rejected —
`outcome`/`objective` are already channel-agnostic (per `payment-promises/spec.md`), and a
parallel type would drift from the shared one exactly the way the removed `objective.type`
field did.

### New `voiceAutopilot.ts` service, mirroring `emailAutopilot.ts` / `whatsAppAutopilot.ts`

Same shape: `buildPrompt`, `parseDecision`, `mockDecide` (regex fallback), `googleDecide`
(REST call to Gemini), `createVoiceAutopilot(ai): { decide }`. The prompt differs only in
wording — it describes a finished call, asks for `outcome`/`objective` from the full
transcript, and constrains `action` to `ignore | resolve | escalate` (documented above).
Provider dispatch (`mock` / `google` / not-yet-implemented others) is copied as-is; this
change does not add new LLM providers.

**Alternative considered**: fold voice into `emailAutopilot.ts` as a third prompt branch.
Rejected — the three services already duplicate `parseDecision`/mock-fallback structure
rather than sharing it (an existing, accepted pattern in this codebase per the two current
files), and voice's request shape (no reply cap, no thread-message role duplication concerns)
doesn't need to share a module to share the underlying types.

### Decision runs once, after transcript persistence, gated by AI config — not by insight-generation timing

In `voiceEvents.ts`, after `ingest(req.body)` succeeds and `event.eventType ===
"conversation.ended"`, load the gestión's full context (transcript, agent system prompt,
account context) and call `voiceAutopilot.decide()`, then `recordOutcome` if an outcome came
back. This runs unconditionally when AI is configured (mirroring Email/WhatsApp, where
`decide()` is not optional) — it is **not** gated by `deps.generation === "onIngestion"`,
because that flag controls the _timing_ of the advisory AI insight (an operator-facing
summary), whereas payment-promise capture is functional outcome capture, the same category
of work as Email/WhatsApp's decide loop, not an analysis toggle.

Like insight generation and billing settlement, this runs **after** the response is sent
(`res.status(200).json(...)`) and is wrapped so a failure only logs — it must not turn a
successful ingestion into a 500, and must not block/slow the webhook response Fonoster is
waiting on.

**Alternative considered**: run synchronously before responding, so a decision failure could
surface as a webhook error for retry visibility. Rejected — matches the existing insight
generation precedent in the same handler, and a slow/failed LLM call must not risk the
autopilot events-hook timing out or retry-storming over something that isn't required for
event acknowledgment.

### Context loading follows the WhatsApp ad-hoc/campaign resolution pattern

The Prisma client backing the decision step resolves the agent's `systemPrompt` via
`log.campaign?.agentTemplate?.voiceAiConfig` when a campaign is attached, falling back to a
direct `agentTemplate.findUnique({ where: { id: log.agentTemplateId } })` lookup for ad-hoc/
follow-up dispatches (`campaignId` null) — the same two-path resolution already implemented
in `whatsAppWebhook.ts`. Account context (`customerName`, `outstandingBalance`,
`preferredLanguage`) is built the same way as the other channels via `buildOutreachContext`.

### Idempotency and outcome safety are inherited, not reimplemented

`recordOutcome` already guarantees: a real outcome is never downgraded, and re-delivery of
the same event does not duplicate a `PaymentPromise` (`@@unique([contactLogId])`). Since
`conversation.ended` can be redelivered by Fonoster (same as the existing billing-settlement
idempotency concern already documented in `voiceEvents.ts`), the decision step relies on
these existing guarantees rather than adding call-ref-based dedup of its own.

## Risks / Trade-offs

- **[Risk] A long/noisy transcript makes the "one decision from the whole call" prompt less
  reliable than per-turn decisions (Email/WhatsApp see one new message at a time).**
  → Mitigation: prompt explicitly asks the model to weigh the _final_ stated intent, not
  every hedge across the call; this is inherent to the mid-call vs. end-of-call constraint
  documented in Non-Goals, not something this change can fully solve.
- **[Risk] `conversation.ended` may arrive with a very short/empty transcript (call dropped
  immediately).** → Mitigation: mirror `generateGestionInsight`'s `no_transcript` guard —
  skip the decision step (no outcome written) when the transcript is empty, same as insights.
- **[Risk] Decision step adds a second LLM call per finished Voz IA call (alongside insight
  generation), doubling AI cost/latency for voice.** → Accepted trade-off: outcome capture is
  the functional gap being closed; a follow-up could investigate combining insight + decision
  into one prompt/call, but that risks conflating an advisory analysis with a
  validation-gated, `recordOutcome`-driving decision — out of scope here per Non-Goals.
- **[Risk] Reusing `action: reply` semantics from the shared schema is dead weight for
  voice** (mirrors the `objective.type` lesson from the earlier fix). → Mitigation: documented
  explicitly in Non-Goals and enforced in the voice prompt/handler; if this proves confusing
  in practice, a follow-up can split a voice-specific decision shape once there's a concrete
  reason to diverge, not preemptively.

## Migration Plan

No data migration. Deploys as new code paths behind existing `ai` config (mock fallback when
absent, matching Email/WhatsApp behavior day one). Rollback is a plain revert — no schema or
persisted-data changes to unwind.

## Open Questions

- Should the voice decision prompt receive the same `referenceDate`/relative-date resolution
  Email/WhatsApp use for `objective.dueDate` ("mañana", "el viernes")? Voice transcripts are
  spoken, so relative dates are equally likely to appear — plan to carry the same
  `referenceDate` instruction into the voice prompt unless testing shows Gemini handles
  transcript speech patterns differently.
