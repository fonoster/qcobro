# whatsapp-channel Specification

## Purpose

TBD — created by syncing change whatsapp-channel. Update Purpose after archive.

## Requirements

### Requirement: Outbound WhatsApp template messaging via Meta Cloud API

The system SHALL open a WhatsApp outreach by posting a Meta-approved **template** message to the
Meta Cloud API (`graph.facebook.com/{phoneNumberId}/messages`) using a `Bearer` access token. Meta
requires the first business-initiated message to be an approved template; the template opens Meta's
24-hour customer-service window. The template send SHALL use **named** parameters: the `WHATSAPP`
agent template's `messageBody` Handlebars `{{vars}}` SHALL be extracted, rendered against the
customer's account context, and sent as `{ parameter_name, text }` body components under the
configured `templateName` and the **workspace-level** language code. The Meta API client SHALL be
injected so unit tests run with an emulator and no live message is sent.

Meta requires named parameters to be lowercase snake_case (e.g. `{{first_name}}`) and rejects
camelCase placeholders outright, while the account context and every other channel's templates use
camelCase field names (`firstName`). The system SHALL map each extracted snake_case token to its
camelCase context field (`first_name` -> `firstName`) to resolve the value, while sending the
`parameter_name` to Meta as the literal snake_case token from the approved template.

#### Scenario: Template is sent with named parameters

- **WHEN** the system dispatches a `WHATSAPP` template whose `messageBody` is
  `"Hola {{first_name}}, su saldo es {{outstanding_balance}}"` to an account named "María López"
  with outstanding balance 1500
- **THEN** the Meta client is called with the configured `templateName`, language code, and body
  parameters `[{ parameter_name: "first_name", text: "María" }, { parameter_name: "outstanding_balance", text: "1500" }]`
- **AND** the returned provider message id is recorded as the gestión `providerRef`

#### Scenario: Unapproved or mismatched template fails at send time

- **WHEN** the configured `templateName` is not an approved Meta template, or its placeholders do
  not match the sent parameters
- **THEN** the dispatch fails with a structured error carrying the Meta error code
- **AND** the failure reason is surfaced in logs, not silently swallowed

### Requirement: Inbound WhatsApp webhook ingestion and opt-out suppression

The system SHALL expose an authenticated inbound webhook for Meta WhatsApp events. It SHALL
complete Meta's verify-token handshake, verify the request signature before processing, and
reject unverified requests. The webhook SHALL resolve each event to a workspace by its
`phoneNumberId`. When an inbound event indicates a customer block or opt-out, the system SHALL set
the corresponding account's `IntentStatus` to `OPT_OUT`, which the campaigns funnel already treats
as global cross-campaign suppression. Delivery and quality-rating callbacks SHALL update the
sending number's cached `qualityRating`.

#### Scenario: Opt-out suppresses the account globally

- **WHEN** a verified inbound event reports that a customer opted out or blocked the WABA number
- **THEN** the matching account's `IntentStatus` is set to `OPT_OUT`
- **AND** subsequent campaign ticks exclude that account across all campaigns

#### Scenario: Unverified webhook request is rejected

- **WHEN** an inbound webhook request fails signature verification
- **THEN** the request is rejected without mutating any data

#### Scenario: Quality rating callback updates the sender number

- **WHEN** a verified quality-rating callback is received for a `phoneNumberId`
- **THEN** the matching `WhatsAppSenderNumber`'s `qualityRating` is updated to the reported value

### Requirement: Conversational AI replies within the customer-service window

A `WHATSAPP` agent SHALL be **smart** like the `EMAIL` agent. After the templated opener, when the
customer replies the system SHALL generate a response from the agent's `systemPrompt` and send it
as a **free-form** (non-template) WhatsApp message. Free-form replies are permitted only inside
Meta's 24-hour customer-service window opened by a customer message; outside the window the system
SHALL fall back to a template and SHALL NOT send free-form text. The agent SHALL send at most
`maxReplies` replies per gestión. Each customer message and agent reply SHALL be recorded on
the gestión as a conversation thread. The agent MAY register a payment promise and MUST honor
opt-out intent expressed in the conversation.

#### Scenario: Agent replies to a customer message within the window

- **WHEN** a customer replies to a WhatsApp outreach and the gestión is within Meta's 24-hour window
  and below `maxReplies`
- **THEN** the system generates a reply from the agent's `systemPrompt` and sends it as a free-form
  WhatsApp message
- **AND** records both the customer message and the agent reply on the gestión

#### Scenario: Reply cap stops the agent

- **WHEN** the agent has already sent `maxReplies` replies in a gestión
- **THEN** a further customer message does not trigger another automated reply

#### Scenario: Expired window forbids free-form replies

- **WHEN** a customer message arrives after the 24-hour window has closed
- **THEN** the system does not send a free-form reply
- **AND** any re-engagement uses an approved template

#### Scenario: Customer asks to stop during the conversation

- **WHEN** the customer expresses an opt-out intent in a reply
- **THEN** the account's `IntentStatus` is set to `OPT_OUT` and the agent does not continue messaging
