# WhatsApp — Verification, Account Health & Template-Approval Runbook

Internal runbook for the WhatsApp channel (`openspec/changes/whatsapp-channel/`, tasks
1.1–1.3). Audience: Fonoster/QCobro ops and support, not the customer — the customer-facing
version of the setup steps lives in the hosted docs at `docs-site/guides/whatsapp.mdx`. This
runbook covers what to watch and how to help when a workspace connects or runs into trouble
with their own WhatsApp Business Account (WABA).

Background: a WABA is **tenant-owned** — each workspace supplies its own Meta credentials via
the Workspace Integrations area (`WhatsAppIntegration` + `WhatsAppSenderNumber`, per
`openspec/changes/whatsapp-channel/design.md` decisions 1–4, 7). QCobro cannot complete Meta's
verification steps on the customer's behalf; this runbook is about supporting that process and
keeping a connected account healthy afterward, not performing it for them.

## 1. Meta Business verification flow

Before a workspace can send anything, their WABA needs, on Meta's side:

1. **Business Manager verification.** Meta requires a verified business before approving
   template messaging at any real volume. This can take from same-day to a couple of weeks
   depending on the documentation Meta requests.
2. **Phone number registration.** The customer registers the sending number in their WhatsApp
   Business Account. A number already active on personal WhatsApp or another BSP must be
   migrated/released first — this is the most common stall point; budget for it.
3. **Display-name review.** Meta separately reviews the display name shown to end customers.
   Reject-prone patterns: names that don't match the verified business, or that read as
   generic/deceptive (e.g. "Pagos", "Cobranza" with no company identifier).

**When a customer asks for help getting connected:**

- Confirm they have all three of: WABA ID, a long-lived access token with `whatsapp_business_messaging`
  permission, and a phone number ID from a **registered** number. QCobro's Integraciones page
  (`WhatsAppIntegration.upsert`) will accept malformed values and only fail at send time —
  there's no live verification against Meta on save.
- If saves succeed but sends fail immediately, check the Meta error code surfaced in the
  gestión/log first (§3 below) before assuming a QCobro-side bug.

## 2. Operator-side template-approval handoff

The full customer-facing version of this section is `docs-site/guides/whatsapp.mdx` ("Aprueba
tu plantilla en Meta") — point customers there. The two rules that matter operationally:

- **Category: UTILITY**, not MARKETING. Debt-collection reminders are transactional; submitting
  under MARKETING invites stricter review and different sending limits.
- **Named parameters, not positional.** The template's placeholder names must exactly match
  QCobro's documented variable set (`docs-site/guides/agent-templates.mdx#lista-de-variables`
  — `firstName`, `outstandingBalance`, etc.). QCobro extracts `{{tokens}}` from the fetched
  template body and sends them as `{ parameter_name, text }` by name
  (`mods/apiserver/src/functions/outreach/dispatchOutreach.ts`); a mismatched or positional
  (`{{1}}`) name means that field renders empty or Meta rejects the send outright.

When a customer's template gets rejected by Meta, the two most common causes are category
mismatch and copy that reads as promotional (discounts, urgency language) rather than a plain
account notice.

## 3. Account-health playbook

### Quality-rating monitoring

Meta grades each sender number GREEN / YELLOW / RED and can throttle or pause a number that
degrades. QCobro caches the current rating on `WhatsAppSenderNumber.qualityRating` from Meta's
webhook quality-rating callbacks (`mods/apiserver/src/rest/whatsAppWebhook.ts`) — there is no
scheduled poll, only whatever Meta pushes. If a customer reports delivery problems, check that
field first; a RED number needs a new number requested through Meta, not a QCobro-side fix.

### Opt-out handling

An inbound Meta block/opt-out event maps to `IntentStatus.OPT_OUT`, the same global,
cross-campaign suppression used by every other channel (`engine/funnel.ts`,
`GLOBAL_SUPPRESSED`). No WhatsApp-specific suppression exists or is needed — if a customer asks
"why did outreach stop for this account," `IntentStatus.OPT_OUT` is the first thing to check
regardless of which channel triggered it.

### Template-policy compliance

- Confirm new templates stay UTILITY category (§2) — a customer resubmitting a rejected
  template as MARKETING to get it approved faster trades a policy problem for a stricter one.
- Watch for **send-time** rejections even on a previously approved template: Meta can
  re-review and pause a template after the fact. Error code **132012** ("parameter format
  mismatch") specifically means the template's approved parameter names/format no longer match
  what QCobro is sending — usually because the customer edited the template in Meta Business
  Manager after configuring it in QCobro. QCobro's read-only preview is fetched once at
  configuration time (`WhatsAppClient.fetchTemplate`), not re-verified on every send (v1 scope —
  see design.md's deferred "Verify template" action).

### Number-ban escalation

If Meta suspends a number (as opposed to just downgrading its quality rating):

1. Any campaigns pointed at that `WhatsAppSenderNumber` stop dispatching — WhatsApp campaigns
   pick a specific sender, not a rotating pool (design.md decision 5), so nothing silently
   fails over to another number.
2. Have the customer request reinstatement or a new number through Meta Business Manager
   directly — QCobro has no ban-appeal path of its own.
3. Once they have a working number, add it as a new `WhatsAppSenderNumber` in Integraciones and
   repoint affected campaigns at it (`Campaign.whatsAppSenderNumberId`).
4. Do not delete the banned `WhatsAppSenderNumber` row while any campaign still references it —
   the FK is restrictive (no cascade); repoint campaigns first.

## References

- Design: `openspec/changes/whatsapp-channel/design.md`
- Customer-facing setup guide: `docs-site/guides/whatsapp.mdx`
- Variable reference operators/support share when a template is being submitted:
  `docs-site/guides/agent-templates.mdx#lista-de-variables`
