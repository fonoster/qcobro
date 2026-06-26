## Why

`EMAIL` is already a valid agent channel (an `AgentType` with an `EmailConfig`), but it
has **no dispatcher** — so the campaigns engine reports `channel_not_supported` and no
email is ever sent. Email is also the one channel where, like Voice AI, the customer
**replies** — with promises, disputes, questions — and we need to capture those outcomes
and decide how to respond. This change makes EMAIL a real, **bidirectional** channel.

## What Changes

- **Outbound email via Resend**: `dispatchOutreach` gains an `EMAIL` branch that sends the
  rendered collection notice (subject + body) through Resend, returning a provider ref.
- **Inbound replies via a Resend webhook**: a new `POST /api/email/inbound` endpoint
  receives replies, correlates each to its originating gestión (by a per-attempt reply-to
  token carried as `providerRef`, plus `References`/`In-Reply-To`), and appends it to the
  email thread on that gestión.
- **EMAIL becomes an AI autopilot** (mirrors VOICE_AI): the EMAIL agent gains a
  `systemPrompt`. On each inbound reply the agent decides the next action —
  **reply / ignore / resolve / escalate** — and, when replying, generates and sends the
  response through Resend.
- **A reply cap per collection attempt**: a configurable max number of AI replies per
  thread, so a debtor can't keep the AI talking indefinitely; past the cap the agent stops
  replying (escalate/ignore).
- **Outcome capture on inbound**: replies are AI-analyzed to extract outcomes
  (`PAYMENT_PROMISE`, etc.) + `Objective`s and set suppression, reusing the existing
  insight path — exactly as the voice-events hook does.
- **Engine support**: EMAIL is now a dispatchable channel with its own pacing bucket; the
  engine no longer skips EMAIL campaigns as `channel_not_supported`.
- A new **`resend` config block** in `qcobro.json` (API key, sending domain/from, inbound
  webhook signing secret, default reply cap).

## Capabilities

### New Capabilities

- `email-channel`: the bidirectional email channel — Resend outbound send, the inbound
  webhook + thread correlation, the AI autopilot decision loop (reply/ignore/resolve/
  escalate) with a per-attempt reply cap, and inbound outcome capture.

### Modified Capabilities

- `channel-dispatch`: add `EMAIL` to the dispatch channels; `dispatchOutreach` sends via
  the injected Resend client (provider-injected, emulatable in tests).
- `agent-templates`: the EMAIL config gains a `systemPrompt` (the autopilot's decision
  brain) and an optional per-agent reply cap; `subject`/`messageBody` (initial notice)/
  `fromName`/`fromEmail` stay.
- `account-contact-log`: one gestión per email collection attempt, enriched by inbound
  replies (the email thread) and the agent's sent replies, correlated by `providerRef` —
  the email analog of the voice transcript.
- `campaigns-engine`: EMAIL is a supported channel with readiness (Resend configured) and
  per-channel pacing; the reply cap is enforced per `(campaign, account)` thread.

## Impact

- **apiserver**: new `ResendClient` service + `EMAIL` branch in `dispatchOutreach`; a new
  `POST /api/email/inbound` handler + `ingestEmailReply` function (correlate → thread →
  autopilot decision → optional send); engine channel/readiness/pacing for EMAIL.
- **@qcobro/common**: `EMAIL` in the dispatch channel union + schema; EMAIL agent
  `systemPrompt` + reply cap; `resend` config in `qcobroConfigSchema`; email-thread types
  on the gestión.
- **DB (Prisma)**: `EmailConfig.systemPrompt` (+ optional `maxReplies`); store the email
  thread + reply count for the cap (on the gestión `channelData`, or a small thread field).
- **webapp**: EMAIL agent form gains the system prompt; gestión detail renders the email
  thread (like the voice transcript).
- **Deferred / out of scope**: contact identity / global history by email
  (`docs/design-notes/contact-identity.md`); WhatsApp dispatcher; inbound attachments;
  multi-language reply selection beyond the agent prompt.
