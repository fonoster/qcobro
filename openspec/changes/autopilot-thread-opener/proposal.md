## Why

The EMAIL and WHATSAPP autopilots decide on a conversation they can only see half of. Their
first-ever view of it is the customer's _reply_ — nothing about the notice QCobro actually sent
(subject, body, any link or fact stated there) reaches the model, on any turn.

Found while stress-testing the entity-faithful `SIMILAR` judge (#122) against the real production
"mora temprana" EMAIL prompt. That prompt tells the agent to redirect payment questions to
WhatsApp, but the WhatsApp link exists only in the outbound message template — never in
`systemPrompt`, the account `context`, or the `thread`. The agent can say "escríbenos por WhatsApp"
and can never cite the link. A customer who replies "¿de qué trata esto?" cannot be answered at all.

The cause is a key mismatch, traced end to end:

- Dispatch writes the notice as flat `channelData.messageBody` (`engine/engine.ts:512`) — and the
  campaign engine drops `renderedSubject` entirely, though `dispatchOutreach` returns it and the
  manual tRPC path at `trpc/routers/outreach.ts:292-297` keeps it.
- `ingestEmailReply` builds its thread from `existing.emailThread`, a key dispatch never wrote, so
  it always falls back to `{ messages: [], agentReplyCount: 0 }`.
- WHATSAPP is identical (`ingestWhatsAppMessage.ts:117`). Meta's approved-template opener does not
  make it moot — that opener is exactly the message being replied to.
- The eval harness is identical too (`runAutopilotEvaluation.ts:35`), which is why this survived
  undetected: the tool used to test agents reproduced the same blind spot.

The repo had already solved this once, for a different consumer: `generateGestionInsight.ts:27-37`
prepends `messageBody` as the first agent turn, with a comment explaining why. The autopilot never
got the same treatment.

## What Changes

- The autopilot's `thread` for EMAIL and WHATSAPP now **leads with the dispatched notice**, built
  from `channelData.messageBody`/`subject` at decision time by a single shared helper,
  `buildThreadWithOpener` in `@qcobro/common`. `generateGestionInsight` is moved onto the same
  helper, so a reply and an insight can never be built from different views of a conversation.
- **Not a data-shape change.** The opener is not persisted into `channelData.emailThread`. It is
  assembled where it is used, which keeps `messageBody` the single home of the notice, needs no
  migration or backfill, fixes gestiones already in flight, and avoids the console rendering the
  notice twice (`GestionDetail.tsx:363`/`:448` already show it above the thread).
- The engine now persists the rendered EMAIL `subject` on dispatch, matching what the manual
  dispatch path has always done.
- The EMAIL prompt renderer now includes a message's `subject` when it has one — previously only
  `body` was rendered, so even a stored subject would not have reached the model.
- An autopilot reply's `Re:` subject now falls back to the subject **we sent**. The old fallback,
  `thread.messages[0]?.subject`, resolved to the first _inbound_ message.
- Eval scenarios seed the same opener, rendered against the scenario's synthetic account, so an
  eval turn sees what production sees.
- **Adjacent fix:** WHATSAPP now passes `referenceDate` to `decide`, as EMAIL always has. Without
  it the model cannot resolve "el viernes" into an absolute `objective.dueDate`, so a relative
  promise could not become a dated `PaymentPromise`.

Explicitly **not** in scope: any truncation or context window. There is none today — both prompt
builders render the entire thread every turn, and the only bound is the reply cap (default 3). The
spec now states that guarantee rather than leaving it as an accident of the implementation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `email-channel`: the "EMAIL autopilot decision loop" requirement gains what the decision step is
  given — the notice as the first turn, and the whole thread on every turn.
- `whatsapp-channel`: the same on "Conversational AI replies within the customer-service window",
  plus the reference-date guarantee for dated promises.

## Impact

- **Contracts:** `@qcobro/common` gains `buildThreadWithOpener`. `EvalAgentTemplateRow.emailConfig`
  gains `subject` (already selected from Prisma; the TS type was just narrower than the row).
- **apiserver:** `functions/email/ingestEmailReply.ts`, `functions/whatsApp/ingestWhatsAppMessage.ts`,
  `functions/voice/generateGestionInsight.ts`, `services/emailAutopilot.ts`, `engine/engine.ts`,
  and the two eval files `resolveEvalTarget.ts` / `runAutopilotEvaluation.ts`.
- **Web console:** no change. The opener is not persisted, so nothing new renders.
- **Behavior:** agents can now answer questions about the notice, cite what it contained, and reply
  under the right subject. Reply quality changes on every EMAIL/WHATSAPP conversation — worth a
  re-run of the eval suite after deploy, since scenario expectations were written against an agent
  that could not see the opener.
- **Not affected:** SMS and both voice channels — neither runs an autopilot decision loop.
