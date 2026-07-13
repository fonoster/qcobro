# Design note — SMS provider capability audit: Dominican Republic

**Status:** Exploration. Feeds the provider capability audit requested in
[#6](https://github.com/fonoster/qcobro/issues/6) (bidirectional SMS). Scoped to
one country (DR) as a first data point; extend the same method to other priority
countries before generalizing the adapter interface.

## Question

QCobro's outreach today is outbound-only and Twilio-specific for SMS. Before
designing a provider-agnostic adapter with a `supportsInbound` capability flag,
we need real data on which providers can do two-way SMS to the Dominican
Republic, and at what cost — not just "does the provider exist" but "does the
DR carrier network + that provider's product actually support receiving a
reply."

## Method

Pulled primary sources (official pricing pages, official per-country guideline/
capability tables) wherever available; used web search only to locate those
pages, not as the source of truth. Where a provider had no public per-country
page, that absence is recorded as a finding, not filled in with a guess.

## Capability matrix

| Provider | Outbound price / segment to DR | Two-way (inbound) in DR | Number types available | Source confidence |
| --- | --- | --- | --- | --- |
| **Twilio** | $0.1308 | **Yes** — short code only. Long code (domestic & international) and alphanumeric sender ID are explicitly **not supported by DR carriers** per Twilio's own capability table | Short code, ~4-week provisioning | High — official [pricing](https://www.twilio.com/en-us/sms/pricing/do) + [guidelines](https://www.twilio.com/en-us/guidelines/do/sms) pages |
| **AWS End User Messaging** (SMS) | Not publicly listed (country-selector tool, no static page) | **Yes** — same shape as Twilio: short code only, no long code, no sender ID | Short code only | High on capability — [official country table](https://docs.aws.amazon.com/sms-voice/latest/userguide/phone-numbers-sms-by-country.html); price unconfirmed. Note: classic **SNS** `Publish` is outbound-only in every country — two-way requires the separate End User Messaging product plus a leased number |
| **Plivo** | $0.0673 (Claro) – $0.2727 (other carriers) | **No** — explicitly "Not Supported" | None; sender ID auto-converted to a shared short code | High — official [coverage](https://www.plivo.com/sms/coverage/do/) + pricing pages |
| **Telnyx** | Not publicly listed | Not documented either way | Alphanumeric sender ID, no registration required | Medium — [guideline page](https://support.telnyx.com/en/articles/6665730-dominican-republic-sms-guidelines) is a few lines and simply doesn't mention inbound |
| **Bandwidth** | Not publicly listed — contract / Account Manager only | Not documented for DR specifically. General claim: 119 countries for 1-way A2P, 2-way A2P "expanding" | Unknown | Low visibility — no self-serve, country-specific public page exists at all |
| **Vonage** | Not publicly listed | Not confirmed. Public snippet says P2P traffic is prohibited (A2P only); full restrictions article returned HTTP 403 | Unknown | Low — primary source partially inaccessible |
| **Sinch** | ~$0.098 (third-party quoted; Sinch's own pricing page is a JS country-selector, not independently confirmed) | Not documented | Unknown | Low |
| Bulk aggregators (Unimatrix, Releans, sendsmsgate, etc.) | ~$0.076–$0.10 flat | Outbound-only bulk/OTP gateways — not a bidirectional CPaaS integration | Varies | Low reliability tier for a production integration |

## What this means for DR specifically

DR carriers **do** support two-way SMS at the network level (confirmed
independently by both Twilio's and AWS's official per-country tables) — but
only through a **leased short code**: ~4 weeks to provision, and short codes
generally lease around **$1,000+/month** (Twilio's own help center figure for
a dedicated short code), on top of per-segment pricing. That's a fixed
enterprise cost, not a marginal per-message one.

Every other provider we could get primary data on either doesn't support it
(Plivo, explicitly) or simply doesn't publish anything about it one way or the
other (Telnyx, Bandwidth, Vonage, Sinch) — which is not the same as "supported"
and shouldn't be treated as such in the capability matrix.

**Practical takeaway:** there is no cheap, self-serve, publicly-documented
inbound SMS endpoint for DR from any provider surveyed. Genuine bidirectional
SMS into DR is possible today only via Twilio or AWS's short-code product, and
only at short-code economics. Cheapest *outbound-only* option (Plivo, carrier-
dependent) is not a substitute — it explicitly cannot receive replies.

## Implications for the provider abstraction

- The `supportsInbound` capability flag proposed in #6 needs a third state
  beyond boolean: **supported / unsupported / undocumented**. Bandwidth,
  Vonage, Sinch, and Telnyx would sit in "undocumented" for DR until confirmed
  via a sales conversation — the adapter shouldn't silently assume either
  answer.
- Per-country capability (not just per-provider) matters: the same provider
  (Twilio, AWS) supports two-way in DR only via short code, while for other
  countries it may support long codes or sender IDs instead. The capability
  flag likely needs to be scoped per provider **and** per destination country,
  not just per provider.
- Short-code economics (~$1k+/month, weeks of lead time) mean bidirectional
  SMS for a given country is realistically an opt-in, ops-approved
  configuration per workspace — not something QCobro should default to
  enabling once the adapter exists.

## Open questions / follow-ups

- Repeat this audit for the other priority countries before finalizing the
  adapter interface (see #6, acceptance criterion 1).
- Get an actual quote from Bandwidth, Vonage, and Sinch account teams for DR
  two-way support and pricing — the public-docs gap doesn't mean the capability
  doesn't exist, just that it isn't self-serve.
- Confirm AWS End User Messaging per-segment DR pricing (their pricing tool is
  JS-only; no static per-country price list found).
