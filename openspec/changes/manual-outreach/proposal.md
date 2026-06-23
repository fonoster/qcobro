## Why

Agent templates can be created for every channel, but nothing can actually _send_ an
outreach. The platform needs the trigger layer: functions that take an agent template + a
customer account and dispatch a real message — a Fonoster voice call (Voz IA or
pre-recorded) or a Twilio SMS. These dispatch functions are the same primitives the
(deferred) campaigns engine will call on its hot path, so they are built standalone,
provider-injected, and unit-tested before any UI touches them.

Operators also need to reach a single customer **now**, outside any scheduled campaign —
from the customer's row inside a Cartera (portfolio). A "Contactar manualmente" action
opens a modal that picks the agent template, optionally adjudicates the contact to a
campaign, previews the personalized body, and fires the dispatch.

## What Changes

- **Body templating (Handlebars).** Agent-template bodies — Voz IA `firstMessage` /
  `systemPrompt`, pre-recorded `script`, SMS `messageBody` — are treated as Handlebars
  templates. At dispatch time they are rendered against the customer's account fields
  (`{{firstName}}`, `{{outstandingBalance}}`, `{{daysPastDue}}`, currency, …) so every
  outreach is personalized.
- **Dispatch functions (reusable trigger layer).** A `dispatchOutreach` validated function
  routes by channel to `dispatchVoiceCall` (Fonoster, Voz IA + pre-recorded) and
  `dispatchSms` (Twilio). Each is a pure trigger: it renders the body, picks a sending
  number, calls the injected provider client, and returns a structured `DispatchResult`
  (channel, provider ref, the rendered body, from/to). No DB writes — the engine and the
  manual procedure decide what to record.
- **Provider clients (ports + adapters).** New `OutboundCallClient` (Fonoster `Calls`) and
  `SmsClient` (Twilio) ports in `@qcobro/common`, with apiserver adapters injected through
  the tRPC context. Unit tests inject stubs — no live provider calls.
- **Number rotation.** `qcobro.json` gains a Fonoster `numbers` list (E.164) and a Twilio
  `fromNumbers` list; a sending number is chosen per dispatch via an injectable selector.
- **Manual outreach from a Cartera.** The customer row's actions menu (⋯) in the portfolio
  accounts view gains "Contactar manualmente", opening a modal (agent template select,
  optional campaign adjudication, rendered body preview, send). A new tRPC
  `outreach.dispatch` procedure loads the account + template (workspace-scoped), dispatches,
  and records the manual attempt as a gestión.

## Capabilities

### New Capabilities

- `channel-dispatch`: provider-agnostic outreach trigger functions (voice via Fonoster,
  SMS via Twilio) with Handlebars body templating and per-dispatch sending-number rotation;
  the primitive the campaigns engine and the manual flow both call.

### Modified Capabilities

- `web-console`: the portfolio accounts view gains a "Contactar manualmente" row action and
  modal for one-off, optionally campaign-adjudicated outreach.

## Impact

- **`@qcobro/common`**: new `OutboundCallClient` + `SmsClient` ports; `dispatchOutreach`
  input schema + `DispatchResult` type; Handlebars-based `renderTemplate` + outreach-context
  builder; `twilio` config block + `fonoster.numbers` / `twilio.fromNumbers` in the config
  schema. New dep: `handlebars`.
- **`mods/apiserver`**: `FonosterOutboundCallClient` (uses `@fonoster/sdk` `Calls`) and
  `TwilioSmsClient` adapters; `dispatchOutreach` / `dispatchVoiceCall` / `dispatchSms`
  validated functions; `outreach` tRPC router + context wiring; new dep: `twilio`.
- **`mods/webapp`**: "Contactar manualmente" action + modal in the portfolio accounts view;
  new i18n keys.
- **`qcobro.json`**: `fonoster.numbers`, `twilio` block (accountSid, authToken, fromNumbers).
- **Out of scope (deferred):** EMAIL and WhatsApp dispatch; Twilio delivery-status webhooks;
  the campaigns engine that will batch-call these functions.
