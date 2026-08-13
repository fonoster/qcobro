# channel-dispatch Specification

## Purpose

TBD — created by syncing change manual-outreach. Update Purpose after archive.

## Requirements

### Requirement: Outreach bodies are Handlebars templates rendered per customer

Agent-template message bodies SHALL be treated as Handlebars templates and rendered against
the target customer's account before dispatch. The render context SHALL expose the
customer's `PortfolioAccount` fields plus derived values: `firstName` (first token of
`fullName`) and `currency` (the **workspace's** currency from `WorkspaceSettings`).

Money-typed account fields — `outstandingBalance`, `principalAmount`, `termsAmount` and
`lastPaymentAmount` — SHALL be exposed as amounts formatted for the workspace's `locale`
(from `WorkspaceSettings`), including grouping separators. Count-typed fields —
`daysPastDue`, `missedInstallments` and `termsLength` — SHALL be exposed unformatted. This
formatting is not opt-in: a template referencing `{{outstandingBalance}}` receives the
formatted amount with no additional syntax.

Rendering SHALL NOT HTML-escape (bodies are plain text / voice script / SMS), and an unknown
or missing field SHALL render as empty rather than aborting the dispatch.

The templated bodies are: Voz IA `firstMessage` and `systemPrompt`, pre-recorded `script`,
and SMS `messageBody`.

#### Scenario: Body is personalized with account data

- **WHEN** an SMS body `"Hola {{firstName}}, su saldo es {{outstandingBalance}} {{currency}}"`
  is dispatched to an account named "María López" with outstanding balance 1500 in a workspace
  whose currency is `DOP` and whose locale groups thousands with a comma
- **THEN** the rendered body is `"Hola María, su saldo es 1,500 DOP"`

#### Scenario: Money formatting follows the workspace locale

- **WHEN** the same body is dispatched from a workspace whose locale groups thousands with a
  period
- **THEN** the rendered body is `"Hola María, su saldo es 1.500 DOP"`

#### Scenario: Counts are not formatted as amounts

- **WHEN** a body references `{{daysPastDue}}` for an account 1200 days past due
- **THEN** it renders as `1200`, with no grouping separator

#### Scenario: Missing field renders empty, dispatch proceeds

- **WHEN** a body references `{{unknownField}}` for an account that has no such value
- **THEN** that placeholder renders as an empty string
- **AND** the dispatch still proceeds with the rest of the rendered body

### Requirement: Numeric template helpers operate on formatted amounts

Template helpers SHALL interpret an operand that is a locale-formatted amount as its
underlying numeric value, so that formatting money-typed fields does not change any
template's arithmetic or branching. This applies to `multiply`, `eq`, `gt`, `gte`, `ge`, `lt`
and `lte`. Parsing SHALL follow the workspace's locale, since the grouping and decimal
separators differ between locales.

`multiply` SHALL format its result the same way money-typed fields are formatted, so a
computed amount reads aloud like a stored one.

An operand that is neither a number nor a parseable formatted amount SHALL continue to behave
as it does today: `multiply` yields `0`, and comparisons yield false.

#### Scenario: Settlement offer still computes

- **WHEN** a body contains `{{multiply outstandingBalance 0.5}}` for an account with an
  outstanding balance of 9500 in a workspace whose locale groups thousands with a comma
- **THEN** it renders `4,750`

#### Scenario: Comparison branches on the underlying amount

- **WHEN** a body contains `{{#if (gte outstandingBalance 1000)}}` for an account with an
  outstanding balance of 9500
- **THEN** the condition is true

#### Scenario: Non-numeric operand is inert

- **WHEN** a body contains `{{multiply customerSegment 2}}`
- **THEN** it renders `0` and the dispatch proceeds

### Requirement: Digit-by-digit template helper

Templates SHALL provide a `digits` helper that renders a value's digits separated by single
spaces, so text-to-speech reads them one at a time rather than as a single quantity. Non-digit
characters in the value SHALL be dropped. An empty or missing value SHALL render as an empty
string rather than aborting the dispatch.

#### Scenario: Phone number is spelled out

- **WHEN** a pre-recorded script contains `{{digits phone}}` for an account whose phone is
  `8092323333`
- **THEN** it renders `8 0 9 2 3 2 3 3 3 3`

#### Scenario: Formatting characters are dropped

- **WHEN** the account's phone is stored as `+1 (809) 232-3333`
- **THEN** `{{digits phone}}` renders `1 8 0 9 2 3 2 3 3 3 3`

#### Scenario: Missing value renders empty

- **WHEN** a script contains `{{digits externalId}}` for an account with no external id
- **THEN** it renders as an empty string and the dispatch proceeds

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
- **THEN** dispatch fails with a `DispatchError` whose `kind` is `SYSTEM_ERROR`
- **AND** no partial outreach is attempted

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
