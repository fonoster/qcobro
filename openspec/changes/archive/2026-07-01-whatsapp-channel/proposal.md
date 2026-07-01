## Why

WhatsApp is the dominant messaging platform across QCobro's collections-relevant markets, but
QCobro only dispatches voice, SMS, and email today. Adding WhatsApp meaningfully expands reach.
Unlike every existing provider — whose credentials live globally in `qcobro.json` — a WhatsApp
Business Account (WABA) is tenant-owned, so this change also forces QCobro's **first
per-workspace, operator-entered secret storage**: a new Workspace Integrations area.

## What Changes

- **WhatsApp outbound messaging** via the Meta Cloud API (`graph.facebook.com`), opening with a
  Meta-approved template (HSM) sent with **named parameters**: the `WHATSAPP` agent template's
  fetched `messageBody` Handlebars `{{vars}}` are extracted, rendered against the customer context,
  and sent as named template parameters. The template opens Meta's 24-hour customer-service window.
- **Smart conversational agent.** A `WHATSAPP` agent behaves like the `EMAIL` agent: after the
  customer replies, an AI agent (driven by `systemPrompt`, capped by `maxReplies`) responds
  with free-form messages inside the 24-hour window, can register a payment promise, and honors
  opt-out — it is not a one-shot template blast.
- **New per-workspace Workspace Integrations area** — the first place QCobro stores a
  tenant-provided secret. Holds a workspace's `WhatsAppIntegration` (WABA-level: `wabaId`,
  encrypted `accessToken`, `verifyToken`) and its `WhatsAppSenderNumber`s (`phoneNumberId`,
  `displayNumber`, `label`, `qualityRating`, `capabilities`).
- **BREAKING (data model):** `Campaign` gains `whatsAppSenderNumberId`. A WhatsApp campaign
  sends from one explicitly chosen sender number — **not** the random global pool used by
  voice/SMS — because quality rating and conversation continuity are per-number and different
  campaigns legitimately want different sender identities.
- **`channel-dispatch` extended** with a `WHATSAPP` branch. The messaging client is resolved
  **per-call** from the workspace's stored credentials (it cannot be injected globally at boot
  like `fonosterNumbers`); `dispatchOutreach` stays pure and stateless.
- **Inbound webhook + opt-out:** an authenticated Meta webhook ingests delivery/quality
  callbacks and customer messages; a Meta-level block/opt-out feeds back into the existing
  `IntentStatus.OPT_OUT` global suppression.
- **`DispatchChannel` / `dispatchChannelSchema` gain `WHATSAPP`** (today they list only
  `VOICE_AI | VOICE_PRERECORDED | SMS | EMAIL`, even though `AgentType` already has `WHATSAPP`).
- **Encryption-at-rest decision** for the WABA access token (key management has no precedent in
  this repo).
- **Non-goals (documented, not built):** WhatsApp **voice notes** (audio messages) are dropped —
  Meta policy makes them wrong for outbound-initiated collections. **WhatsApp Voice** (the Meta
  Business Calling API) is captured as a future direction in `design.md`, with deliberate
  guardrails so this change does not corner it; the leaning is to let **Fonoster own the
  WhatsApp calling transport** for `VOICE_AI` agents.

## Capabilities

### New Capabilities

- `whatsapp-channel`: Outbound WhatsApp template messaging via the Meta Cloud API (named
  parameters, per-call client resolution from workspace credentials); a smart conversational AI
  agent that replies free-form within Meta's 24-hour window (`systemPrompt`/`maxReplies`,
  like email); plus the inbound webhook and Meta-level opt-out feeding the global suppression set.
- `workspace-integrations`: Per-workspace, operator-entered provider integrations and their
  encrypted secrets — introduced WhatsApp-first (WABA + sender numbers with capability flags),
  but the secret-at-rest pattern is built to generalize to future providers.

### Modified Capabilities

- `channel-dispatch`: Add the `WHATSAPP` routing branch and the `WhatsAppClient` port; the
  client is resolved per-call from the owning workspace's integration rather than injected once
  at boot. `DispatchChannel` gains `WHATSAPP`.
- `campaigns`: A campaign references one `WhatsAppSenderNumber` (explicit per-campaign sender),
  rather than relying on a random global number pool.
- `agent-templates`: The `WHATSAPP` template modal becomes **template-id-driven and read-only** for
  the opener — the operator enters a Meta template id, QCobro fetches the template from the
  workspace's WABA and renders its body read-only (the body is owned by Meta, unlike the editable
  SMS/EMAIL bodies). The config stores `templateId` + resolved `templateName` + fetched
  `messageBody`, plus operator-authored `systemPrompt` and `maxReplies` (mirroring `EmailConfig`,
  since the agent is smart). It carries **no** `language` field — the Meta template-send language is
  `WhatsAppIntegration.defaultLanguage` (per-workspace, all WhatsApp config kept together).

## Impact

- **`mods/common`**: `DispatchChannel`/`dispatchChannelSchema` gain `WHATSAPP`; new
  `WhatsAppClient` port and dispatch input fields; new workspace-integration schemas/types.
- **`mods/apiserver`**: new `MetaWhatsAppClient` (portable from sibling repo `../mikro`,
  `mods/agents/src/whatsapp/client/`) with `sendTemplate`, free-form `sendText`, and
  `fetchTemplate`; `WHATSAPP` branch in `dispatchOutreach`; per-call client resolution in the engine
  and manual-outreach flows; **inbound message → AI reply handling reusing the email agent's
  reply mechanism** (`systemPrompt`/`maxReplies`, 24h-window guard); Prisma models
  (`WhatsAppIntegration`, `WhatsAppSenderNumber`) + `Campaign.whatsAppSenderNumberId` migration +
  `WhatsAppConfig` gaining `templateId`/`systemPrompt`/`maxReplies`; secret encryption; inbound
  webhook route; tRPC procedures for the integrations area.
- **`mods/webapp`**: new Workspace Integrations area reachable from the **avatar menu** (next to
  Miembros / Configuración del espacio); WhatsApp sender selection on campaign creation; the
  `WHATSAPP` agent modal's template-id input + read-only fetched preview + system-prompt/max-replies
  fields.
- **Dependencies**: Meta Cloud API (no new SDK required — direct `fetch`, mirroring `../mikro`).
  Operators must complete Meta Business verification and template approval out-of-band. The modal's
  read-only preview **does** call Meta (`GET /{wabaId}/message_templates`) at config time to resolve
  the template by id; send-time approval is still Meta's and a changed/withdrawn template fails at
  send (error 132012).
