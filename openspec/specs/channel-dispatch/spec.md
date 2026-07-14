# channel-dispatch Specification

## Purpose

TBD — created by syncing change manual-outreach. Update Purpose after archive.

## Requirements

### Requirement: Outreach bodies are Handlebars templates rendered per customer

Agent-template message bodies SHALL be treated as Handlebars templates and rendered against
the target customer's account before dispatch. The render context SHALL expose the
customer's `PortfolioAccount` fields plus derived values: `firstName` (first token of
`fullName`) and `currency` (the **workspace's** currency from `WorkspaceSettings`).

Rendering SHALL NOT HTML-escape (bodies are plain text / voice script / SMS), and an unknown
or missing field SHALL render as empty rather than aborting the dispatch.

The templated bodies are: Voz IA `firstMessage` and `systemPrompt`, pre-recorded `script`,
and SMS `messageBody`.

#### Scenario: Body is personalized with account data

- **WHEN** an SMS body `"Hola {{firstName}}, su saldo es {{outstandingBalance}} {{currency}}"`
  is dispatched to an account named "María López" with outstanding balance 1500 in a workspace
  whose currency is `DOP`
- **THEN** the rendered body is `"Hola María, su saldo es 1500 DOP"`

#### Scenario: Missing field renders empty, dispatch proceeds

- **WHEN** a body references `{{unknownField}}` for an account that has no such value
- **THEN** that placeholder renders as an empty string
- **AND** the dispatch still proceeds with the rest of the rendered body

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
- **THEN** dispatch fails with a structured error
- **AND** no partial outreach is attempted

### Requirement: Sending numbers rotate from a configured pool

Voice dispatch SHALL select its caller-ID `from` number from a configured Fonoster
`numbers` list (E.164), and SMS dispatch from a configured Twilio `fromNumbers` list. The
selection SHALL go through an injectable selector so it is deterministic under test and the
rotation strategy can change without touching dispatch logic.

#### Scenario: Each dispatch picks a number from the pool

- **WHEN** a dispatch runs with a configured pool of E.164 numbers
- **THEN** the `from` of the resulting `DispatchResult` is one of the configured numbers

#### Scenario: Empty pool is a configuration error

- **WHEN** a dispatch runs for a channel whose number pool is empty
- **THEN** dispatch fails with a structured error rather than sending from no number

### Requirement: EMAIL channel dispatch

The dispatch layer SHALL support an `EMAIL` channel alongside the voice and SMS channels.
An EMAIL dispatch SHALL render the agent's subject and message body against the account
context and send them through the injected email provider client, returning a provider ref
(the per-attempt reply-to token). The email provider client SHALL be injected like the
voice and SMS clients so it can be replaced by an emulator in tests. An EMAIL dispatch
request SHALL be rejected by validation when it has no subject or no body.

#### Scenario: EMAIL dispatch sends through the provider

- **WHEN** the dispatch layer is asked to send an EMAIL request with a subject and body
- **THEN** the rendered subject and body are sent via the injected provider client
- **AND** the returned provider ref is the per-attempt reply-to token

#### Scenario: EMAIL dispatch validates required content

- **WHEN** an EMAIL dispatch request is missing its subject or body
- **THEN** validation fails with a structured error and nothing is sent

### Requirement: WHATSAPP channel dispatch

The dispatch layer SHALL support a `WHATSAPP` channel alongside the voice, SMS, and EMAIL
channels, and `DispatchChannel` SHALL include `WHATSAPP`. A WHATSAPP dispatch SHALL render the
agent template's `messageBody` Handlebars `{{vars}}` against the account context and send them as
named template parameters through an injected `WhatsAppClient`, returning a `DispatchResult` whose
`providerRef` is the Meta message id. Because Meta's named parameters are lowercase snake_case
while the account context is camelCase, each `{{vars}}` token SHALL be mapped to its camelCase
context field to resolve the value (see `whatsapp-channel` for the exact mapping); the
`parameter_name` sent to Meta stays the literal token from the template. Unlike the voice and SMS
clients — which are injected once at boot from deployment-global configuration — the
`WhatsAppClient` SHALL be resolved per dispatch from the owning workspace's stored integration
credentials and passed in by the caller, so `dispatchOutreach` remains pure and writes nothing to
the database.

#### Scenario: WHATSAPP dispatch sends through the resolved client

- **WHEN** `dispatchOutreach` runs for a `WHATSAPP` template with a `WhatsAppClient` resolved from
  the workspace's integration
- **THEN** the rendered named parameters are sent via that client under the configured
  `templateName`
- **AND** the returned `DispatchResult` has `channel: WHATSAPP` and the provider message id

#### Scenario: WHATSAPP dispatch fails clearly when the integration is missing

- **WHEN** a WHATSAPP dispatch runs for a workspace with no WhatsApp integration or no resolved
  sender number
- **THEN** dispatch fails with a structured error
- **AND** no partial outreach is attempted
