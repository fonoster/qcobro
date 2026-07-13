# Design note — WhatsApp Voice via Meta Business Calling API: transport ownership, config, and pricing

**Status:** Exploration. Answers [fonoster/qcobro#12](https://github.com/fonoster/qcobro/issues/12).
Follow-up to `whatsapp-channel` (#5, archived) and `voice-integration` (archived), which
deliberately reserved the ground for this: `WhatsAppSenderNumber.capabilities.calling` and two
dormant billing meters (`whatsappVoicePrerecorded`, `whatsappVoiceAi`) already exist in the specs,
unused until this transport ships.

## Question

Issue #12 asks for clarity on configuration, pricing, and implementation difficulty for WhatsApp
Voice (Meta's Business Calling API — real-time VoIP, not voice notes), under a fixed
responsibility split: **Fonoster owns the calling transport/infra, QCobro presents it as a voice
sub-option alongside PSTN.** The design.md "future direction" section already leaned toward
Fonoster owning it (fork A) without confirming *how*. This note answers that "how."

## Method

Read this repo's `whatsapp-channel` design doc and current specs (`channel-dispatch`,
`workspace-integrations`, `agent-templates`, `usage-ledger`, `billing-plans`, `voice-events-hook`)
for what's already modeled. Read `fonoster/fonoster`'s public repo structure (`mods/sipnet`,
`mods/autopilot`, `mods/voice`) and public docs for its SIP/telephony architecture. Pulled Meta's
official Calling API docs (pricing, requirements, SIP configuration) via primary sources. Checked
`fonoster/fonoster#329` (2022 WhatsApp-integration request, closed as out-of-roadmap-at-the-time)
for prior art.

## Recommendation up front

**Fork A (Fonoster owns it) is not just preferable, it's cheap** — cheaper than the design.md
anticipated. The key finding: Meta's Business Calling API natively supports a **SIP connection
mode** (digest auth, standard SDP/SRTP over SIP, port 5061) as an alternative to its default
Graph-API-managed WebRTC mode. Fonoster's SIP layer (Routr) already does exactly this class of
thing for PSTN trunks, and already bridges WebRTC↔SIP for browser calling via its `RTPRelay`
component. So this isn't "build a WebRTC media server" — it's "add a new SIP trunk peer," which is
Fonoster's core competency.

## Fonoster side — what "native capability" looks like

**Today's shape:** `mods/sipnet` models `trunks`, `numbers`, `agents`, `domains` — Trunks give SIP
connectivity to carriers, Numbers route inbound/outbound legs to Applications, and `mods/autopilot`
runs the live AI conversation on whatever call lands on an AUTOPILOT Application, regardless of
which leg originated it. `outboundCallClient.createCall(from, to, appRef)` — what QCobro already
calls for PSTN — is transport-agnostic by construction: `from` just needs to resolve to a routable
Number.

**Meta's SIP mode:** `POST /{phone_number_id}/settings` with `calling.sip.status = ENABLED` and a
`servers` array (hostname, port 5061); auth is HTTP digest where the **username is the normalized
business phone number** and the **password is Meta-generated**, retrievable via
`GET /{phone_number_id}/settings`. This is structurally a SIP trunk credential set, not a bespoke
protocol.

### What the "trunk" concretely looks like

Unlike Twilio — where you point at *their* well-known domain (`sip.twilio.com`) for both
directions — Meta's SIP mode is a **peered, unregistered** relationship with a different endpoint
per direction. There's no single "sip.whatsapp.com equivalent" that's symmetric; it's two separate
legs:

| | Outbound (you → Meta) | Inbound (Meta → you) |
| --- | --- | --- |
| Target | `sip:+<customer_number>@wa.meta.vc;transport=tls`, port **5061** | Whatever hostname/port **you** registered in the `servers` array — your own public SIP endpoint |
| Auth | Meta challenges your INVITE with `407 Proxy Authentication Required`; you retry with a digest `Authorization` header | Meta expects **you** to challenge *its* INVITE the same way, if you choose to authenticate inbound |
| Username | Normalized business phone number (E.164 digits, no `+`) | Same |
| Password | Meta-generated, fetched via Graph API (see below) — **not** the WABA access token | Same shared secret |
| Transport / codec | TLS mandatory, SRTP mandatory, **Opus only**, no re-INVITEs | Same |

So "the trunk" is really: Meta's fixed domain `wa.meta.vc:5061` for calls you place, plus a
publicly reachable TLS SIP listener *you* stand up and register with Meta for calls placed to you
— you also need a valid TLS cert whose subject matches that hostname, and (per third-party
integration reports) Meta publishes 1000+ IP ranges you'd want to allowlist on that listener
(or allow by hostname instead of chasing the range list). For Fonoster, that public listener is a
Routr edge — exactly the role it already plays for inbound PSTN trunks.

**Proposed primitive:** a new Trunk kind (e.g. `META_WHATSAPP`) that Routr registers/peers against
Meta's SIP servers **per calling-enabled WABA number** — necessarily per-tenant, since Meta issues
one digest password per business phone number, not one for a whole platform. The resulting Number
routes to whichever Application (AUTOPILOT) the tenant already has configured — identical routing
semantics to a PSTN Number today. Outbound calls go through the same `createCall(from, to, appRef)`
shape; `from` just now resolves through a WA-calling Trunk instead of a carrier Trunk.

### How to obtain the credentials and run a simple test

No Fonoster or QCobro code is needed to validate this end-to-end — it's reachable with a Meta
developer account and an open-source SIP UA. Concretely:

1. **Meta Developer setup (the real gate).** Create an app at developers.facebook.com → add the
   WhatsApp product → complete Business Verification (legal-entity documents, a live privacy
   policy URL) → toggle the app to **Live mode** (Development mode blocks the privacy-policy-gated
   Live toggle, and several third-party write-ups treat Live mode as a hard prerequisite for
   calling specifically — see the open question below; public docs are not fully consistent on
   whether a Development-mode test number can enable calling at all, so the first real test is to
   just try it).
2. **Get a `phone_number_id`.** Either the free Cloud API test number Meta issues per app
   (works for messaging today; calling support on it is the open question above) or a real WABA
   number.
3. **Enable calling:**
   ```
   curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/settings" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" \
     -d '{"calling":{"status":"ENABLED"}}'
   ```
   This alone (leaving `sip` unset/disabled) is the *cheapest possible smoke test* — Meta's default
   mode handles signaling via Graph API/webhooks and media via WebRTC, so you can prove calling
   works with **zero self-hosted infrastructure**, before standing up anything SIP-shaped.
4. **Opt into SIP mode**, pointing at a public TLS SIP endpoint you control:
   ```
   curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/settings" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" \
     -d '{"calling":{"sip":{"status":"ENABLED","servers":[{"hostname":"sip.yourtest.example.com","port":5061}]}}}'
   ```
5. **Fetch the generated SIP password:**
   ```
   curl "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/settings?include_sip_credentials=true" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
   → returns `sip_user_password` inside the `servers` array of the response. Username is the
   normalized business number; endpoint for outbound is `wa.meta.vc:5061`.
6. **Point a real SIP UA at it** rather than building Fonoster's trunk first. There's existing
   prior art for exactly this: a public write-up ([Nimble Ape](https://nimblea.pe/blog/whatsapp-business-calling-with-sip))
   configures **Asterisk** (`pjsip.conf`) as the peer, keying off a custom header Meta adds to its
   INVITEs (`X-FB-External-Domain: wa.meta.vc`) to route WhatsApp-origin calls distinctly from
   PSTN; a commercial write-up ([VoiceInfra](https://voiceinfra.ai/blog/whatsapp-business-api-voice-ai-integration-setup-guide))
   confirms the same TLS/5061/digest shape. FreeSWITCH is the other commonly-referenced option. Any
   of these (or a TLS/SRTP/Opus-capable softphone like Linphone for a manual test) is a faster way
   to validate the credential/endpoint shape than provisioning a Routr trunk on day one.
7. **Trigger the first call from the *customer* side, not the business side.** Business-initiated
   calls require a granted call-permission first (see Consent below), which is one more moving
   part. The fastest true end-to-end proof is to have the allow-listed test number **call the
   business number from WhatsApp** — that's user-initiated, has no consent gate, and immediately
   exercises the inbound INVITE → your SIP UA → answer path.

**Credential handoff — recommend QCobro fetches, Fonoster only holds the SIP leg:** enabling
calling and reading the SIP password requires a Graph API call gated by the WABA's *messaging*
access token, which QCobro already stores per workspace (`WhatsAppIntegration.accessToken`).
Cleanest split: QCobro calls Graph API to enable calling + fetch `{hostname, port, username,
password}`, then hands only that narrower SIP credential to Fonoster via `@fonoster/sdk` to
provision the trunk. Fonoster never sees the messaging token; only the derived, calling-scoped
credential crosses the boundary — consistent with "Fonoster holds calling infra, QCobro holds the
tenant relationship."

**New `@fonoster/sdk` surface needed:** CRUD for the WA-calling trunk/number resource, parallel to
existing Trunks/Numbers calls. No changes needed to the Applications/Agents API surface QCobro
already uses for AUTOPILOT.

**Effort: Medium.** Reuses existing Trunk/Number/Application primitives and Routr's existing
SIP↔WebRTC bridging — not a rearchitecture. But it's a real new integration surface: a new trunk
kind, a per-tenant SIP registration lifecycle (numbers added/removed, and Meta can **revoke**
calling after repeated unanswered calls — ties trunk health to Meta's call-permission state), and a
new webhook consumer for Meta's `calls` field (call-state events, `callback_permission_status`
changes). Comparable in scope to adding a new carrier/trunk integration — not comparable to
standing up a browser-calling stack from scratch, since Routr already has that.

## QCobro side — what changes

- **`VOICE_AI` agent template and the AUTOPILOT app itself: unchanged.** Confirms the design.md's
  framing — this is a new transport, not a new agent type.
- **New concept: transport selection on dispatch.** Today's voice dispatch assumes one global PSTN
  path — a boot-injected `OutboundCallClient` and a global `fonosterNumbers` pool. WA voice needs a
  **per-workspace** resolved sender, mirroring the WhatsApp *messaging* dispatch's already-shipped
  pattern (per-call client resolution, `channel-dispatch` spec) rather than the PSTN pattern: `from`
  is a `WhatsAppSenderNumber` with `capabilities.calling = true`, not a `qcobro.json` pool entry.
  Concretely: the dispatch layer needs a branch that picks global-pool-PSTN vs.
  per-workspace-WA-calling-sender, keyed off which sender the campaign selected — same shape as the
  `WHATSAPP` messaging branch that shipped in `channel-dispatch`, not new machinery.
- **Consent gating is QCobro's job, not Fonoster's.** Meta requires a call-permission per
  business-user pair, rate-limited in production (1/day, 2/week) and revocable after 2–4
  consecutive unanswered calls. This is funnel/campaign business logic — deciding *when* to rely on
  recent engagement vs. send a call-permission request — analogous to how WhatsApp opt-out already
  funnels into `IntentStatus.OPT_OUT`. Propose tracking call-permission state next to the existing
  WA engagement/window state, gating WA-voice dispatch the same way the 24h messaging window already
  gates free-form replies.
- **Billing is already provisioned — this is the most surprising finding.** `whatsappVoicePrerecorded`
  and `whatsappVoiceAi` are two of the seven required meters in the current `billing-plans` spec
  today, explicitly called out in the `workspace-billing` change as *"reserved/dormant until
  Fonoster ships that transport."* Increment billing (launch increments `15/15`), estimate-at-dispatch
  / settle-on-completion (`usage-ledger`), and per-workspace rate overrides all already generalize to
  any voice meter. **No new billing mechanism is needed** — only real rate numbers once Fonoster's
  cost basis is known, and a settlement signal for WA calls shaped like `voice-events-hook`'s
  `conversation.ended` (answered-seconds → settle).
- **No new tenant secret in QCobro**, if Fonoster holds the derived SIP credential as proposed
  above — only the already-reserved `capabilities.calling` flag, plus a deployment-level flag/base
  URL that turns on the "Voz IA via WhatsApp" transport option in the UI (same shape as
  `fonoster.webhookBaseUrl` gating the events-hook today).
- **UI presentation — treat as a transport toggle on VOICE_AI, not a new channel.** Matches the
  ask to "present this feature in a way that makes sense in relation to other channels": once a
  workspace has a calling-capable WhatsApp sender number, a `VOICE_AI` campaign gets a PSTN /
  WhatsApp sender choice, next to the existing WhatsApp *messaging* sender picker — it does not get
  a new agent-template type or a new channel icon.

**Effort: Low–Medium.** Billing and suppression scaffolding already exist; the net-new QCobro work
is the transport/sender-resolution branch in dispatch (small — same shape as the already-shipped
`WHATSAPP` branch), call-permission state tracking, and the transport-choice UI.

## Pricing

Meta charges only for **business-initiated, answered** calls; customer-initiated (inbound) calls
are free. Billing is in **6-second pulses** (fractional pulses round up), tiered by the **called
country's monthly volume** (higher volume → lower rate), and a call that crosses a volume tier
mid-call is priced entirely at the lower rate. The actual per-minute rate card is a gated CSV/PDF
(available once Calling is enabled on a WABA or via a BSP), not published inline — **no public
per-minute Dominican Republic figure was found**, the same kind of gap the [DR SMS capability
audit](sms-provider-capability-dr.md) hit for AWS pricing.

Framing the delta rather than the absolute number: today's PSTN `voiceAi` rate = carrier
termination (DR-specific, per-minute) + Fonoster's AI compute (TTS/STT/LLM) baked in. WA voice's
cost = Meta's per-minute calling rate (**replaces** the termination leg) + the **same** AI compute,
since the AUTOPILOT pipeline is unchanged. So repricing `whatsappVoiceAi`/`whatsappVoicePrerecorded`
is a one-variable problem — Meta's DR calling rate vs. Fonoster's current DR PSTN termination rate —
not a wholesale repricing exercise.

One more wrinkle: the call-permission request that unlocks a WA call is itself a UTILITY template
send, already priced under the existing `whatsappMessage` meter — no separate cost line, just
consumes messaging quota and the 1/day-2/week production rate limit per business-user pair.

**Next step:** pull Meta's calling rate card for DR specifically (needs a WABA with Calling enabled,
or a BSP/partner data pull) before setting the two reserved meter rates — same primary-source method
used in the SMS audit.

## Answers to issue #12's checklist

- **Is WhatsApp-as-an-AUTOPILOT-transport on Fonoster's roadmap?** Not currently tracked as active
  work. A near-identical ask (`fonoster/fonoster#329`) was filed in 2022 and closed as
  out-of-roadmap-at-the-time ("focus on things we can implement in a reasonable time"), pushed to a
  since-quiet [discussion](https://github.com/fonoster/fonoster/discussions/332). This note is the
  case for reopening it now that Meta ships a SIP calling mode, which changes the effort estimate.
- **What does Meta's Business Calling API require?** Business phone number on Cloud API (not the
  consumer app), a minimum 2,000-unique-recipient daily messaging tier, `whatsapp_business_messaging`
  permission on the app, and (for calling specifically) a `calls` webhook subscription unless using
  SIP mode. No separate "verification tier" beyond that is documented.
- **How does the consent/24h-window model constrain a collections flow?** Business-initiated calls
  need a granted call-permission per business-user pair; production accounts are capped at 1
  request/day and 2/week per pair, and 2 consecutive unanswered calls trigger review (4 revoke
  approval) — meaning collections campaigns must be conservative about retry cadence or risk losing
  calling ability on that number.
- **If (A): what SDK surface, and where do credentials live?** New Trunk/Number CRUD in
  `@fonoster/sdk`; recommend QCobro (which already holds the WABA messaging token) fetches the
  Meta-issued SIP digest credential and hands only that to Fonoster, per the split above.
- **Billing/metering differences vs. PSTN?** None structurally — same increment-billing and
  estimate/settle machinery, already modeled as two dormant meters; only the underlying rate number
  differs, and that's blocked on Meta's DR-specific rate card.

## Open questions / follow-ups

- Confirm with Fonoster's roadmap owners whether this gets scheduled — the 2022 closure predates
  today's product direction and Meta's SIP calling mode didn't exist then.
- Get the DR-specific Meta calling rate card (blocked on Calling-enabled WABA or BSP access).
- Confirm whether the 2,000-daily-messaging-tier requirement is per-number or per-portfolio under
  Meta's 2025 portfolio-based tiering shift — affects which QCobro tenants are even eligible before
  any of this matters.
- Design the call-permission-state tracking model precisely (new field vs. extending
  `WhatsAppSenderNumber.capabilities`) as a small follow-up spec once fork A is confirmed.
- **Resolve the test-number/Live-mode contradiction directly by trying it.** Meta's own docs list
  "app in Live mode" as a calling prerequisite; separately, third-party sources describe sandbox/
  test numbers as usable for calling with relaxed limits (and note US-based test numbers can't
  reach some countries, e.g. Brazil, under policy). Public docs don't reconcile this — the fastest
  way to know is `POST .../settings {"calling":{"status":"ENABLED"}}` against a Development-mode
  test number and see whether the API accepts it, before assuming full Business Verification is
  required just to run the smoke test in step 3 above.
- The 1000+ published IP ranges (or hostname-based allowlisting) for the inbound SIP listener is an
  operational detail worth scoping alongside the Trunk work — confirm Routr's ingress can allowlist
  by hostname rather than maintaining Meta's IP range list.

## Sources

- [Calling API Pricing — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/pricing)
- [Cloud API Calling — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling)
- [SIP Configuration Guide — WhatsApp Business Calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/sip)
- [Configure Call Settings — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/call-settings)
- [WhatsApp Business Calling with SIP — Nimble Ape (Asterisk reference config)](https://nimblea.pe/blog/whatsapp-business-calling-with-sip)
- [WhatsApp Business API Voice AI Integration Setup Guide — VoiceInfra](https://voiceinfra.ai/blog/whatsapp-business-api-voice-ai-integration-setup-guide)
- [Fonoster SIP Network concepts](https://docs.fonoster.com/concepts/sipnetwork)
- [Routr RTPRelay component docs](https://routr.io/docs/2.11.5/development/components/rtprelay/)
- [fonoster/fonoster#329 — WhatsApp Integration (closed 2022)](https://github.com/fonoster/fonoster/issues/329)
- [fonoster/qcobro#12 — this exploration issue](https://github.com/fonoster/qcobro/issues/12)
- [fonoster/qcobro#5 — whatsapp-channel exploration](https://github.com/fonoster/qcobro/issues/5)
