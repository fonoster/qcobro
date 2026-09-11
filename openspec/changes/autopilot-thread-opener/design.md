# Design — the initial message in the autopilot's view

## Decision 1: build the opener at decision time, don't persist it

Issue #128 proposed seeding the notice as the first `EmailThreadMessage` in
`channelData.emailThread.messages` at dispatch time, so `ingestEmailReply`'s existing thread-loading
would pick it up for free. That works, but it costs more than it saves:

- **The console would show the notice twice.** `GestionDetail.tsx:363` (EMAIL) and `:448`
  (WHATSAPP) already render `channelData.messageBody` as its own first bubble, then the thread
  below it. Seeding would need a de-duplication rule in the webapp keyed on message equality.
- **It would trip the auto-insight.** `GestionDetail.tsx:201` requests an AI analysis when
  `emailThread.messages.length > 0`. Today that means "the customer replied". With a dispatch-time
  seed, every gestión would have a one-message thread from the moment it was sent, and would
  request an analysis of a conversation that has not happened.
- **It needs a backfill.** Every gestión already in flight has no `emailThread`, so the fix would
  not reach any conversation currently running — exactly the ones being stress-tested.
- **It duplicates the notice** into two keys of the same JSON blob, which then have to agree.

Building it in memory has none of those costs and is not a new idea in this repo:
`generateGestionInsight.ts:27-37` has always prepended `cd.messageBody` for the same reason. This
change extracts that into `buildThreadWithOpener` in `@qcobro/common` and points both the insight
path and the two autopilot paths at it, so there is one definition of "the conversation" rather
than two that can drift.

The one thing dispatch-time seeding would have given us — a self-contained thread record on disk —
we do not actually need: `channelData.messageBody` is that record, and it is written unconditionally
by both dispatch paths.

**Consequence:** `EmailThreadMessage.at` is `""` on the opener. The notice's send time is on the
gestión (`contactedAt`), not in `channelData`, and no prompt renderer reads `at`. Inventing a
timestamp would be worse than an obviously-absent one. If a renderer ever needs it, the gestión's
`contactedAt` is the value to thread through — not a guess made here.

## Decision 2: the WhatsApp link belongs in `systemPrompt` too

Independent of this change, and worth recording because it is the more reliable half of the fix.

A fact that exists only in the outbound message template — the WhatsApp link, a portal URL, an
office address — reaches the model only as long as the notice is in the thread and the model
attends to it. `systemPrompt` reaches the model verbatim, first, on every single turn, and survives
someone editing the message template without thinking about the agent.

So: **state such facts in `systemPrompt` as well as in the message.** This change makes the notice
_visible_; it does not make it the right place to keep a load-bearing fact. That is prompt
authoring, not code, so nothing here enforces it — it is noted on issue #128 and belongs in the
operator-facing guidance on writing agent prompts.

## Decision 3: no context window, and the spec now says so

The issue asked to verify that nothing silently truncates the thread as it grows. It does not:
`emailAutopilot.ts` and `whatsAppAutopilot.ts` both render all of `req.thread` on every turn, and
the only `.slice(` calls in either file extract JSON from a fenced model response. The only bound
is the reply cap — `min(agent.maxReplies, resend.maxRepliesDefault)`, default 3.

That is currently an accident of the implementation rather than a stated guarantee, which is how it
could have been lost in a later refactor. The spec deltas state it, so a future windowing change has
to be a deliberate spec change with a stated trade-off.

A cap of 3 agent replies bounds a thread at roughly 7 messages plus the opener, so token cost is not
a live concern. If the cap ever rises substantially, the right move is summarising older turns, not
dropping them — but that is a different change with a different failure mode.

## Open question

Eval scenario expectations were authored against an agent that could not see the opener. Some may
now be wrong in the other direction — an expectation that the agent asks a clarifying question may
fail because it can now answer directly. That is the fix working, not a regression, but the suite
needs a re-run and a pass over failures before its results mean anything again.
