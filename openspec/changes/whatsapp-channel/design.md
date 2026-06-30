## Context

QCobro dispatches voice (Fonoster), SMS (Twilio), and email (Resend) today. Every provider's
credentials are **deployment-global**, living in `qcobro.json` and injected once at boot into
`DispatchDeps` (e.g. `fonosterNumbers`, `twilioFromNumbers`, `emailFrom`). `dispatchOutreach`
(`mods/apiserver/src/functions/outreach/dispatchOutreach.ts`) is a pure, stateless trigger that
routes on channel and returns a `DispatchResult` — it backs both the campaigns engine and the
manual flow and never touches the DB.

WhatsApp breaks the global-credentials assumption: a WhatsApp Business Account (WABA) is
**tenant-owned**, so credentials are per-workspace and operator-entered. QCobro has never stored
a tenant-provided secret — `WorkspaceSettings` holds only currency + timezone.

The data layer is **partially stubbed**: `AgentType` already includes `WHATSAPP`, the
`WhatsAppConfig` Prisma model exists (`templateName`, `messageBody`), `createAgentTemplate`
handles the `WHATSAPP` case, and `channelIcon` maps it. The entire gap is the **dispatch path**
(`DispatchChannel`/`dispatchChannelSchema` still omit `WHATSAPP`; no `WhatsAppClient`; no
provider implementation) and the **per-workspace integration storage**.

A proven reference implementation exists in the sibling repo `../mikro`
(`mods/agents/src/whatsapp/`). It uses the Meta Cloud API directly with **named** template
parameters and ships a complete client, webhook schema, and template-send builder we can port.
mikro is single-tenant, so its global `whatsapp` config block does **not** transfer; the client
internals do.

## Goals / Non-Goals

**Goals:**

- Send Meta-approved WhatsApp templates (HSM) outbound, personalized per customer via named
  parameters, through the existing `dispatchOutreach` trigger.
- Introduce a per-workspace Workspace Integrations area that stores WABA credentials and sender
  numbers, with the access token encrypted at rest — built WhatsApp-first but generalizable.
- Let a campaign send from one explicitly chosen WhatsApp sender number.
- Ingest an inbound Meta webhook and route Meta-level opt-out/block into the existing
  `IntentStatus.OPT_OUT` global suppression.
- Keep `dispatchOutreach` pure: the per-workspace messaging client is resolved by the caller and
  passed in, not held as boot-time global state.
- Leave the door open for **WhatsApp Voice** (Meta Business Calling API) without modeling it now.

**Non-Goals:**

- **WhatsApp voice notes** (pre-recorded audio messages). Meta only permits audio inside an open
  24-hour conversation window; collections outreach is always outbound-initiated, so voice notes
  cannot start a conversation. Dropped, not deferred.
- **WhatsApp Voice / Business Calling API.** Captured below as a future direction with guardrails;
  no calling code, schema, or transport ships in this change.
- **Per-workspace WABA for SMS/voice/email.** Those stay global in `qcobro.json`. Only WhatsApp
  goes per-workspace here.
- **Multi-WABA per workspace** and **sender-number rotation within a campaign.** One WABA per
  workspace, one sender per campaign, for v1.
- **Automated template-approval verification.** A "Verify template" fetch-from-Meta step is
  deferred; v1 trusts the operator (see Decisions).

## Decisions

### 1. Provider: Meta Cloud API directly (not Twilio WhatsApp)

`POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages` with a `Bearer` token, mirroring
`../mikro/mods/agents/src/whatsapp/client/sendMessage.ts`. **Why:** operators own their WABA
directly (required for compliance and for the future calling capability anyway); avoids a Twilio
intermediary and Twilio's separate WhatsApp onboarding; the stored `templateName` already assumes
a Meta template name. **Alternative considered:** reuse `TwilioSmsClient` with `whatsapp:` number
prefixes — rejected because Twilio's WhatsApp product needs its own Business Profile approval and
re-routes through Twilio rather than the operator's own WABA.

### 2. Named template parameters, sourced from the agent template body

Meta named-parameter templates declare placeholders by name (`{{name}}`, `{{amount}}`). The
`WHATSAPP` agent template's `messageBody` is a Handlebars string using the **same** named
placeholders. At dispatch we extract the `{{tokens}}` from `messageBody`, render each against the
customer context (the same context `channel-dispatch` already builds — account fields plus
`firstName`/`currency`), and send them as `{ parameter_name, text }` components. **Why:**
`messageBody` is the source of which variables to send; matching is by-name and automatic; mikro
confirms named params work end-to-end. **Rule:** the Meta-approved template's named placeholders
MUST be drawn from QCobro's documented variable set. **Alternative considered:** positional
`{{1}}/{{2}}` params with a separate ordered mapping — rejected as more config and more drift
surface.

### 3. The WHATSAPP agent-template modal is template-id-driven; the body is read-only

Unlike the SMS/EMAIL channels — where the operator authors `messageBody` freely in the modal — the
WHATSAPP template body is **not editable in QCobro**. It is owned by Meta (approved in Business
Manager), so the modal works the other way around: the operator enters the **Meta template id**, and
QCobro **fetches the template from the workspace's WABA** (`GET /{wabaId}/message_templates`) and
renders its body **read-only** in the textarea as a preview, in the workspace's configured language.
On save we resolve and store `templateName` and the fetched body as `messageBody` (a cached preview

- the variable source from Decision #2) — never operator-typed text. **Why:** editing a Meta
  template inside QCobro would let the stored copy drift from what Meta will actually send; pulling by
  id makes the preview authoritative and surfaces a wrong/missing/unapproved id at config time rather
  than at send time. **Dependency:** the workspace WhatsApp integration must exist before a WHATSAPP
  agent template can be created (the fetch needs WABA creds). **Note:** this promotes the previously
  deferred "Verify template" Meta fetch into v1, but only for the modal preview; send-time still relies
  on Meta and a bad template still fails with error 132012 if it changes after configuration.

### 4. Per-workspace integration, modeled at the WABA level with capabilities

```
WhatsAppIntegration            (per workspace — the WABA)
  workspaceRef  (FK, unique)
  wabaId
  accessToken   ← tenant secret, ENCRYPTED at rest
  verifyToken   ← inbound webhook verification
     │ 1..n
     ▼
WhatsAppSenderNumber
  id
  workspaceRef
  phoneNumberId    ← Meta per-number messaging endpoint
  displayNumber    ← E.164, for UI
  label            ← e.g. "Cobranza Suave" / "Gestión Final"
  qualityRating    ← cached from Meta webhook (GREEN/YELLOW/RED)
  capabilities     ← { messaging: true, calling: false }
```

**Why WABA-level, not "messaging config":** the same WABA number that sends templates is what
would later host WhatsApp calls. Naming the entity after a capability (`whatsAppMessagingConfig`)
would corner the future calling work. The `capabilities` flag lets a number advertise `calling`
later without a remodel. **Alternative considered:** fold credentials into `WorkspaceSettings` —
rejected; settings is for non-secret display config and a flat row can't hold 1..n numbers.

### 5. Sender selection is per-campaign, not a random pool

`Campaign` gains `whatsAppSenderNumberId`. **Why:** WhatsApp number identity carries quality
rating and conversation continuity, and different campaigns legitimately want different sender
identities/brands — unlike voice/SMS where `pickRandomNumber` rotates an interchangeable global
pool. **Alternative considered:** attach the number to the agent template — rejected so templates
stay reusable across campaigns and numbers.

### 6. Per-call client resolution; `dispatchOutreach` stays pure

The messaging client cannot be injected at boot (credentials are per-workspace). The engine and
manual flows resolve the owning workspace's `WhatsAppIntegration` + chosen sender, build/look up a
`MetaWhatsAppClient`, and pass it into the dispatch call (in deps or params for that call).
`dispatchOutreach` adds a `WHATSAPP` branch that uses the passed-in client and remains stateless —
no DB, consistent with how it already originates voice and sends SMS/email.

```
engine / manual flow                         dispatchOutreach (pure)
────────────────────                         ───────────────────────
resolve workspace WhatsAppIntegration   ──▶  WHATSAPP branch:
+ sender → decrypt token → build             extract {{tokens}} from messageBody,
MetaWhatsAppClient(phoneNumberId, token)     render against context, send named params,
                                             return DispatchResult { channel, providerRef, ... }
```

### 7. Secret-at-rest — reuse the Fonoster/Routr "cloak" pattern

The WABA `accessToken` is encrypted at rest using **`prisma-field-encryption`** — the same
library Fonoster and Routr already use (`mods/apiserver/src/core/db.ts`,
`mods/pgdata/src/db.ts`). The field is annotated `/// @encrypted` in `schema.prisma` and the
`PrismaClient` is extended once with `fieldEncryptionExtension({ encryptionKey })`; encryption and
decryption are then transparent — no hand-rolled AES helpers and no explicit decrypt step at
client-build time. **We do not invent a scheme.**

- **Key format:** versioned AES-GCM-256, e.g. `k1.aesgcm256.<base64-32-byte>` (the cloak format),
  which supports rotation via decryption-key lists.
- **Key source:** `qcobro.json` (deployment-owned), consistent with the existing "config via
  qcobro.json" convention — only the _key_ is global; the _secret_ is per-workspace in the DB.
  Fonoster sources it from an env var (`APISERVER_CLOAK_ENCRYPTION_KEY`); QCobro uses qcobro.json.
- **Conditional enable:** follow Routr's pattern — when no key is configured, the client is built
  without the extension and the WhatsApp integration area is simply unavailable, rather than
  crashing boot (matches the migration plan).

This removes the prior open question about which algorithm to use and whether to build per-workspace
keys: we adopt the deployment-wide cloak key, exactly like the sibling services.

### 8. Inbound webhook + opt-out into existing suppression

An authenticated Meta webhook (verify-token handshake + signature check) ingests message and
status callbacks. A Meta-level block/opt-out maps to `IntentStatus.OPT_OUT`, which the funnel
already treats as global cross-campaign suppression (`GLOBAL_SUPPRESSED` in
`engine/funnel.ts`) — no new suppression mechanism. The webhook body schema is portable from
`../mikro/mods/common/src/schemas/whatsapp.ts`.

### 9. WHATSAPP is a smart conversational agent (template opener + AI replies)

A `WHATSAPP` agent behaves like the `EMAIL` agent, not like `SMS`. **Why:** Meta's messaging model
is conversational and the 24-hour customer-service window invites a real exchange; treating WhatsApp
as a one-shot blast would waste it. The opener must be an approved template (Decision #3), but once
the customer replies the agent converses using its operator-authored `systemPrompt`, capped by
`maxReplies`, mirroring `EmailConfig`. Replies are **free-form** `sendText` calls allowed only
inside the open 24h window; after it closes, re-engagement requires a template again. The
inbound-message handler **reuses the email agent's AI-reply mechanism** rather than inventing a new
one, and the same conversation can register a payment promise or detect opt-out. **Alternative
considered:** a template-only one-shot channel like SMS — rejected; it ignores how WhatsApp is
actually used and the platform's window semantics. **Implication:** `WhatsAppConfig` gains
`systemPrompt` + `maxReplies`; dispatch needs both `sendTemplate` and `sendText`; the gestión
is a conversation thread (see the gestión-detail design).

## WhatsApp Voice — future direction (NOT in scope)

Captured so this change does not corner it. "WhatsApp Voice" here means the **Meta Business
Calling API** (real-time VoIP), which is distinct from the dropped voice notes.

**It belongs to the voice world, not the messaging world.** `dispatchOutreach` already originates
real-time voice via `outboundCallClient.createCall(from, to, appRef)` — the AUTOPILOT app then
runs the live conversation. WhatsApp Voice is the **same `VOICE_AI` autopilot agent over a new
transport** (WhatsApp call setup instead of PSTN), not a new channel. The agent template
(`voice`, `systemPrompt`, `firstMessage`, `language` → AUTOPILOT app) is unchanged.

**Strategic fork — who owns the Meta-CallingAPI ↔ media bridge:**

- **(A) Fonoster owns it — preferred.** Fonoster adds WhatsApp as a transport for AUTOPILOT apps;
  QCobro consumes it via `@fonoster/sdk` exactly like PSTN today, with ~no QCobro media work, and
  WABA-calling credentials could even live in Fonoster. "Fonoster Voice AI via WA" becomes a
  Fonoster platform feature QCobro flips on, reusing `VOICE_AI` agents unchanged.
- **(B) QCobro owns the media bridge.** QCobro bridges Meta's WebRTC/SDP signaling into a media
  server and into Fonoster's pipeline — much heavier, and duplicates what Fonoster already does
  for PSTN.

**Leaning strongly toward (A): let Fonoster own the WhatsApp calling transport.** This makes the
question answer itself — WhatsApp Voice is not a separate QCobro channel.

**Consent flow it unlocks:** Meta forbids cold WhatsApp calls; business-initiated calls need
recent engagement or an accepted call-permission request — the same consent shape as templates.
So the natural play is a **messaging → voice escalation on one WABA number**: send a UTILITY
template with a call CTA → customer consents/replies (opens the window) → place a `VOICE_AI`
WhatsApp call. This only works if both capabilities hang off the **same** integration — which is
why decision #4 models the integration at the WABA level.

**Three cheap guardrails honored by this change:**

1. Model the integration as WABA-level with a per-number `capabilities` flag (`messaging: true`
   now, `calling` later) — decision #4.
2. Keep `VOICE_AI` transport-agnostic — no PSTN assumptions baked into the voice path.
3. Do **not** route voice through the messaging `WhatsAppClient`. That port is `sendTemplate`/
   `sendMessage` only; WhatsApp Voice would originate via the Fonoster voice path, parallel to
   `outboundCallClient`.

## Risks / Trade-offs

- **First tenant secret in the repo → encryption-at-rest is now mandatory.** [Risk] a leaked DB
  exposes live WABA tokens. → Encrypt at rest via `prisma-field-encryption` (the Fonoster/Routr
  "cloak" pattern) with a deployment-owned key from `qcobro.json`; field marked `/// @encrypted`,
  encryption transparent; never log decrypted tokens.
- **Out-of-band template approval → send-time failures.** [Risk] operators configure a name that
  isn't approved and sends fail opaquely. → Surface Meta error codes (esp. 132012) clearly in
  logs/UI; ship the deferred "Verify template" action soon after v1.
- **Account health / number bans.** [Risk] poor opt-out handling or template misuse degrades
  quality rating or bans the number. → Cache `qualityRating` per sender from webhooks; honor
  `IntentStatus.OPT_OUT`; document the account-health playbook (Phase 1).
- **Per-call client resolution adds a DB read + decrypt on the hot dispatch path.** [Risk] latency
  / load on the engine tick. → Resolve once per workspace per tick and reuse; cache built clients
  keyed by `phoneNumberId` within a tick.
- **`Campaign.whatsAppSenderNumberId` is a schema change to an archived capability.** [Risk]
  migration touches the live campaigns model. → Nullable FK; only WHATSAPP campaigns require it
  (enforced at campaign-create validation, not the DB).

## Migration Plan

1. Additive Prisma migration: `WhatsAppIntegration`, `WhatsAppSenderNumber`, and nullable
   `Campaign.whatsAppSenderNumberId`. No backfill — existing campaigns are non-WhatsApp.
2. Add the encryption key to `qcobro.json` (and `qcobro.example.json`); absence disables the
   WhatsApp integration area rather than crashing boot.
3. Ship dispatch + integration storage behind the existing channel gating (a workspace with no
   `WhatsAppIntegration` simply cannot create WHATSAPP campaigns).
4. Rollback: WHATSAPP campaigns are opt-in; disabling the area and reverting the migration leaves
   voice/SMS/email untouched.

## Open Questions

- **Does Fonoster's roadmap include WhatsApp as an AUTOPILOT transport (fork A)?** Tracked for
  later exploration in fonoster/qcobro#12 (with the rationale above); not blocking v1.
- **Webhook multiplexing:** one Meta webhook endpoint serves all workspaces — how do we resolve
  the inbound event to a workspace (by `phoneNumberId` → `WhatsAppSenderNumber` lookup)? Confirm
  uniqueness of `phoneNumberId` across workspaces (decision #4 asserts it; needs the Meta-side
  confirmation that a `phoneNumberId` is globally unique, which it is).

## Language code — options & recommendation

Every Meta template send requires a `languageCode` (e.g. `es_DO`, `es_MX`, `en_US`), and the
template must be **approved in that language** under its `templateName` (Meta allows the same
template name to exist in multiple languages). The question is where QCobro sources it.

| Option                                    | How                                                                                                                             | Pros                                                                                                                                                                                                                          | Cons                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A — Sender `languageDefault`**          | every send from a number uses that number's language                                                                            | simple; mirrors mikro's single global `languageCode`                                                                                                                                                                          | conflates transport identity with content language; a number can serve only one language                              |
| **B — Agent template `language`**         | add a `language` field to the WHATSAPP template (mirrors `VOICE_AI`/`EMAIL`)                                                    | consistent with the agent-template pattern                                                                                                                                                                                    | one template = one language; multiplies templates × campaigns just to vary language                                   |
| **C — Account `preferredLanguage`**       | resolve per recipient from `PortfolioAccount.preferredLanguage`                                                                 | most granular                                                                                                                                                                                                                 | requires per-language template approval and a multilingual preview; **`preferredLanguage` is slated for deprecation** |
| **D — Workspace WhatsApp integration** ✅ | a single `defaultLanguage` on the per-workspace `WhatsAppIntegration` record is the template-send language for the whole tenant | one source of truth per tenant; keeps **all WhatsApp config together** (not scattered into general `WorkspaceSettings`); the modal preview renders in exactly that language; no per-template or per-account language plumbing | a workspace that genuinely needs two languages needs two workspaces (acceptable for v1)                               |

**Decision: D — source the template-send language from the workspace's WhatsApp integration.** The
send `languageCode` comes from `WhatsAppIntegration.defaultLanguage` (per-workspace, one integration
per workspace), not from `WorkspaceSettings`, the agent template, the sender number, or the account.
**Why:** it gives one unambiguous language per tenant, keeps all WhatsApp config together rather than
scattering a WhatsApp concern into general settings, the modal can render the read-only template
preview in that exact language, and it keeps the WHATSAPP agent template free of a `language` field. `PortfolioAccount.preferredLanguage`
is **not** used for this and is slated for deprecation — do not build option C on top of it.
The WhatsAppConfig therefore carries **no** `language` field, and `WhatsAppSenderNumber` carries no
`languageDefault` (language is not a property of the transport number).
