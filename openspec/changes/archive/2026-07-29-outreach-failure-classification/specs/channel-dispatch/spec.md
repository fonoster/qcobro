## MODIFIED Requirements

### Requirement: Channel dispatch functions are provider-injected triggers

The system SHALL provide a `dispatchOutreach` function that takes a resolved agent template
(with its channel config), a customer account, and the owning portfolio, and dispatches a
real outreach by routing on the template's channel type:

- `VOICE_AI` and `VOICE_PRERECORDED` → an outbound voice call via the injected
  `OutboundCallClient` (Fonoster).
- `SMS` → a message via the injected `SmsClient` (Twilio).

Each dispatch SHALL render the body (per the templating requirement), select a sending
number, call the injected provider client, and return a `DispatchResult`
(`{ channel, providerRef, from, to, renderedBody }`). Dispatch functions SHALL NOT write to
the database — persistence is the caller's responsibility — so the same functions serve both
the manual flow and the campaigns engine. Provider clients SHALL be injected so unit tests
run with stubs and no live calls.

#### Scenario: Voice dispatch places a call to the template's voice application

- **WHEN** `dispatchOutreach` runs for a `VOICE_AI` template whose `fonosterAppRef` is set
- **THEN** the injected `OutboundCallClient` is called with the account's phone as `to`, a
  selected `from` number, the app ref, and the rendered first message/system prompt
- **AND** the returned `DispatchResult` has `channel: VOICE_AI` and the provider call ref

#### Scenario: SMS dispatch sends via the SMS client

- **WHEN** `dispatchOutreach` runs for an `SMS` template
- **THEN** the injected `SmsClient` sends the rendered `messageBody` from a selected number
  to the account's phone
- **AND** the returned `DispatchResult` has `channel: SMS` and the provider message ref

#### Scenario: Dispatch fails clearly when the channel is not configured

- **WHEN** a voice dispatch runs but no Fonoster app ref exists (or no sending numbers are
  configured), or an SMS dispatch runs with no Twilio configuration
- **THEN** dispatch fails with a `DispatchError` whose `kind` is `SYSTEM_ERROR`
- **AND** no partial outreach is attempted

### Requirement: WHATSAPP channel dispatch

The dispatch layer SHALL support a `WHATSAPP` channel alongside the voice, SMS, and EMAIL
channels, and `DispatchChannel` SHALL include `WHATSAPP`. A WHATSAPP dispatch SHALL render the
agent template's `messageBody` Handlebars `{{vars}}` against the account context and send them as
named template parameters through an injected `WhatsAppClient`, returning a `DispatchResult` whose
`providerRef` is the Meta message id. Unlike the voice and SMS clients — which are injected once at
boot from deployment-global configuration — the `WhatsAppClient` SHALL be resolved per dispatch
from the owning workspace's stored integration credentials and passed in by the caller, so
`dispatchOutreach` remains pure and writes nothing to the database.

#### Scenario: WHATSAPP dispatch sends through the resolved client

- **WHEN** `dispatchOutreach` runs for a `WHATSAPP` template with a `WhatsAppClient` resolved from
  the workspace's integration
- **THEN** the rendered named parameters are sent via that client under the configured
  `templateName`
- **AND** the returned `DispatchResult` has `channel: WHATSAPP` and the provider message id

#### Scenario: WHATSAPP dispatch fails clearly when the integration is missing

- **WHEN** a WHATSAPP dispatch runs for a workspace with no WhatsApp integration or no resolved
  sender number
- **THEN** dispatch fails with a `DispatchError` whose `kind` is `SYSTEM_ERROR`
- **AND** no partial outreach is attempted

## ADDED Requirements

### Requirement: Dispatch failures are classified as delivery-rejected or system-error

Every provider client injected into `dispatchOutreach` (WhatsApp, SMS, voice, email) SHALL, on
failure, throw a structured `DispatchError` carrying a `kind` of either `DELIVERY_REJECTED` (the
provider reached the recipient side of the request and rejected or bounced it — an invalid
number, an unapproved/rejected template, an opted-out recipient) or `SYSTEM_ERROR` (the provider
call could not be evaluated at all — a transport failure, an authentication/credential failure,
a provider-side outage, or a timeout). The classification SHALL be made by the provider client
itself, since only it can interpret its provider's error shape. An error the provider client
cannot classify SHALL default to `SYSTEM_ERROR`, never `DELIVERY_REJECTED`, so an unrecognized
failure mode never gets mistaken for a real, budget-consuming contact attempt.

#### Scenario: A provider rejection classifies as delivery-rejected

- **WHEN** the WhatsApp client's send call receives a Meta API rejection for an invalid
  recipient number or an unapproved template
- **THEN** it throws a `DispatchError` with `kind: DELIVERY_REJECTED`

#### Scenario: A transport or auth failure classifies as system-error

- **WHEN** the WhatsApp client's send call fails due to a network error, a request timeout, or
  an expired/invalid access token (Meta 5xx or 401/403)
- **THEN** it throws a `DispatchError` with `kind: SYSTEM_ERROR`

#### Scenario: An unclassifiable failure defaults to system-error

- **WHEN** a provider client encounters a failure it cannot map to either kind
- **THEN** it throws a `DispatchError` with `kind: SYSTEM_ERROR`
