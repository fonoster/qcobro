# Design — manual-outreach

## Goals

1. A **reusable trigger layer** the campaigns engine can call unchanged: pure, validated,
   provider-injected dispatch functions with no DB coupling.
2. **Personalized bodies** via Handlebars, with the full customer record available.
3. A **manual one-off path** from a Cartera that reuses (1) and (2).

## Templating

- Engine: **Handlebars** with `noEscape: true` (bodies are plain text / SSML-free voice
  script and SMS, never HTML).
- `renderTemplate(template, context)` compiles and renders; unknown helpers/fields render
  empty (Handlebars default) — a missing field never throws mid-dispatch.
- `buildOutreachContext(account, portfolio)` produces the context object:
  - All `PortfolioAccount` fields (fullName, phone, principalAmount, outstandingBalance,
    daysPastDue, missedInstallments, termsAmount, lastPaymentAmount, …).
  - Derived: `firstName` (first token of `fullName`), `currency` (from portfolio).
  - The available variables are exactly the documented set already surfaced in the agent
    list header ({{firstName}}, {{principalAmount}}, {{outstandingBalance}}, …) plus the
    rest of the account record.

## Dispatch functions (validated-function pattern)

```
dispatchOutreach(input, deps) -> DispatchResult     // routes by agentTemplate.type
  ├─ dispatchVoiceCall(input, deps)                 // VOICE_AI, VOICE_PRERECORDED
  └─ dispatchSms(input, deps)                        // SMS
```

- **Input** (validated): the resolved `agentTemplate` (+ its channel config), the customer
  `account`, the owning `portfolio` (for currency), and an optional `from` override.
- **deps** (injected): `{ outboundCallClient, smsClient, fonosterNumbers, twilioFromNumbers,
pickNumber }`. `pickNumber(numbers)` defaults to a random selector; injectable so tests
  are deterministic and a future round-robin is a drop-in.
- **DispatchResult**: `{ channel, providerRef, from, to, renderedBody }`.
- **No DB writes.** Triggers only dispatch. Callers (manual procedure / engine) own
  persistence. This keeps the function safe to call from the engine's hot path with its own
  transaction boundaries.

### Channel specifics

- **Voice (Fonoster).** Both Voz IA and pre-recorded place an outbound call to the
  template's `fonosterAppRef`. The rendered `firstMessage`/`systemPrompt` (Voz IA) or
  `script` (pre-recorded) is passed as call metadata so per-customer personalization does
  not require re-syncing the app. `to` = `account.phone`; `from` = a rotated number from
  `fonoster.numbers`. Adapter wraps `@fonoster/sdk` `Calls` with the same 15s timeout guard
  as the existing voice client. If `fonosterAppRef` is missing, dispatch fails with a
  structured error.
  - **Voz IA = AUTOPILOT app (internal to Fonoster):** synced at template create/update.
  - **Pre-recorded = EXTERNAL app:** Fonoster calls back into an embedded **VoiceServer**
    hosted by the apiserver on its own port (`apiserver.voicePort`, default 50061). The
    server reads the rendered script from the call `metadata` and plays it via the Say
    verb. (Current stub logs the play-ready string; playback/voice selection wired later.
    Provisioning the EXTERNAL Fonoster app pointing at this endpoint is a separate step.)
- **SMS (Twilio).** Renders `messageBody`, sends via Twilio `messages.create({ from, to,
body })`; `from` rotated from `twilio.fromNumbers`. Returns the message SID as
  `providerRef`.

## Manual procedure

`outreach.dispatch({ portfolioAccountId, agentTemplateId, campaignId? })` (protected,
workspace-scoped):

1. Load account (+ portfolio) and agent template, both checked against the caller's
   workspace; load the channel config.
2. `dispatchOutreach(...)`.
3. On success, record the attempt via the existing `createContactLog` (so it appears under
   Gestiones and bumps hot-path counters): `agentType` = template type, `campaignId`
   (if adjudicated), `outcome: "OTHER"`, `notes` = "Contacto manual", `channelData` =
   `{ providerRef, from, to }`. Richer outcomes arrive later via the Fonoster callback
   (`POST /api/contact-logs`, already built) and a future Twilio status webhook.
4. Return the `DispatchResult` to the modal.

## Config

```jsonc
"fonoster": { ..., "numbers": ["+50670000000"] },
"twilio": { "accountSid": "...", "authToken": "...", "fromNumbers": ["+15550000000"] }
```

Both `fonoster.numbers` and `twilio` are optional: when a channel's config/numbers are
absent, dispatch for that channel fails with a clear, structured error (mirrors the voice
template "saves locally when Fonoster absent" posture).

## Decisions

- **No new `ContactOutcome` value tonight.** Manual contacts log as `OTHER` + notes to
  avoid enum/migration churn; an `INITIATED`/`SENT` outcome can come with the engine.
- **Voice + pre-recorded share one dispatch fn** — same provider, same call origination;
  only the rendered payload differs.
- **EMAIL / WhatsApp deferred** — the user named three channels.
