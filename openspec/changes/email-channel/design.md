# Design — email-channel

## Context

EMAIL is a defined `AgentType` with an `EmailConfig`, but no dispatcher exists, so the
engine reports `channel_not_supported`. Email is also bidirectional like Voice AI: the
customer replies, and we must capture outcomes and decide how to respond. We mirror the
VOICE_AI pattern (outbound + provider webhook + correlation by `providerRef` + AI insight)
rather than inventing a new mechanism.

## Key decisions

### 1. Provider: Resend (send + inbound), provider-injected

A `ResendClient` service is injected through the tRPC/engine context, exactly like
`FonosterVoiceApplicationClient`/the Twilio SMS client — so tests use an
`EmulatedEmailClient` and no live calls happen. Outbound uses Resend's send API; inbound
uses a Resend **inbound webhook** delivered to `POST /api/email/inbound`.

### 2. Correlation/threading via a per-attempt reply-to token == `providerRef`

On send, the engine sets a unique reply-to address `reply+<token>@<inboundDomain>` and
stores `<token>` as the gestión `providerRef` (already added for campaigns-engine). Inbound
replies are matched by the token in the `To`/`Delivered-To`, falling back to
`References`/`In-Reply-To` (the original `Message-ID` is also stored). This is the email
analog of `callRef` in `ingestVoiceEvent`.

### 3. EMAIL is an AI autopilot (decision agent), not a static template

The EMAIL agent gains a `systemPrompt`. On each inbound reply, `ingestEmailReply` runs a
**decision** step over the thread + account context and returns a structured result:

```
{ action: "reply" | "ignore" | "resolve" | "escalate",
  replyBody?: string,           // present when action = reply
  outcome?: GestionOutcome,     // e.g. PAYMENT_PROMISE, DISPUTE, WRONG_PERSON
  objective?: { ... } }         // promise details, when applicable
```

- `reply` → send `replyBody` via Resend (subject to the cap, below) and append to thread.
- `resolve` → set the outcome + suppression (e.g. INTENT_MET) and stop.
- `escalate` → flag for an operator, stop auto-replying.
- `ignore` → record nothing actionable, leave the thread open for a later message.

Outcome/Objective capture reuses the existing insight path (never downgrade a real outcome;
guard Objective creation for idempotent re-delivered webhooks) — same guarantees as voice.

### 4. Reply cap per collection attempt

A debtor must not be able to keep the AI talking. The cap = `min(agent.maxReplies,
config.resend.maxRepliesDefault)`. The autopilot counts **agent replies** on the thread;
once the count reaches the cap, the decision step is constrained to `ignore`/`escalate`
(never `reply`). The count lives with the thread (see §5). "One collection attempt" = one
gestión (the thread), so the cap is per `(campaign, account)` attempt.

### 5. Thread + reply count storage: gestión `channelData` (no new table)

The thread (ordered messages: direction, from, at, body, messageId) and the agent reply
count are stored on the existing gestión `channelData` JSON, like the voice transcript.
Avoids a new table for v1; the deferred contact-identity work may later normalize this.

### 6. Engine integration

`dispatchChannelSchema` gains `EMAIL`; `dispatchOutreach` gets an EMAIL branch (render
subject+body, send via Resend, return `providerRef`=token). The engine adds an `email`
token bucket (`resend.maxEmailsPerMinute`) and EMAIL readiness (Resend configured +
inbound domain set), so EMAIL campaigns dispatch and pace like the others.

## Alternatives considered

- **Postmark/Mailgun for inbound** — more mature inbound parsing, but the user prefers
  Resend and it now supports inbound. Provider injection keeps swapping cheap if needed.
- **Message-ID-only threading** — fragile (clients rewrite headers); the reply-to token is
  authoritative, headers are the fallback.
- **A dedicated EmailThread table** — deferred; `channelData` matches the voice precedent
  and keeps the slice small.
- **Auto-reply with no cap** — rejected explicitly: unbounded AI conversation is a cost and
  abuse risk.

## Risks / open items

- **Inbound webhook auth** — like the voice hook, must be signed (Resend signing secret)
  and correlation must be workspace-scoped; the voice hook's `FIXME(security)` applies here
  and is addressed in tasks (verify signature before processing).
- **Loop/auto-responder storms** — out-of-office/auto-replies could burn the cap; detect
  `Auto-Submitted`/`Precedence: bulk` headers and treat as `ignore` without counting.
- **Deliverability/bounces** — bounces/complaints (Resend events) should resolve/suppress;
  v1 records them as outcomes, full bounce handling is a follow-up.
