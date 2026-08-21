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
`phoneNumberId`. Delivery and quality-rating callbacks SHALL update the sending number's cached
`qualityRating`.

The webhook SHALL ingest every entry of Meta's `statuses` array, correlating each to a gestión by
its message id (`status.id`) against the gestión `providerRef`, and map it onto the delivery axis:

- `delivered` → `entrega` of `DELIVERED`
- `read` → `channelData.openedAt`, set once on the first read receipt
- `failed` → `entrega` of `FAILED`, with `deliveryReason` derived from Meta's error codes:
  `131026` (undeliverable) SHALL be `INVALID_DESTINATION`; `131047` (outside the re-engagement
  window), `131048` and `131049` (spam and per-user quality limits), and `131050` (user opted
  out) SHALL be `REJECTED`; any other or absent code SHALL be `PROVIDER_ERROR`. A status MAY
  carry several error codes; the system SHALL scan all of them for a mapped value rather than
  reading only the first, because Meta can lead with a generic code
- `sent` → `channelData.deliveryStatus` visibility only, moving no axis

A `read` receipt SHALL NOT set `camino` or `resultado`, and SHALL NOT by itself advance
`entrega`. Every status SHALL record its raw value in `channelData.deliveryStatus`, terminal or
not.

When a status indicates a customer block or opt-out — a status that is both `failed` and
carries error code `131050` among its error codes — the system SHALL record
`channelData.optOutAt`, and SHALL additionally set the gestión's `resultado` to `OPT_OUT` when
it has no `resultado` yet. Both conditions are required: `131050` on a non-`failed` status
SHALL NOT be treated as an opt-out, since the message in fact reached the recipient.

`resultado` is single-valued, so an opt-out SHALL NOT overwrite a richer outcome the
conversation already produced; `channelData.optOutAt` is what guarantees the block survives
that case, and is therefore the field a Do Not Contact seed SHALL be built from. Neither marker
SHALL be treated as enforced suppression, which belongs to the workspace Do Not Contact list.

Once a gestión has left `DISPATCHED`, no later status SHALL return it to `DISPATCHED` or change
it between `DELIVERED` and `FAILED`, so that redelivered webhooks, out-of-order statuses, and a
customer reply that already advanced the gestión are all safe.

#### Scenario: Delivered status advances entrega

- **WHEN** a verified `delivered` status correlates to a gestión still at `DISPATCHED`
- **THEN** that gestión's `entrega` becomes `DELIVERED`

#### Scenario: Read receipt records the open without moving an axis

- **WHEN** a verified `read` status correlates to a gestión
- **THEN** `channelData.openedAt` is set to the status timestamp
- **AND** `entrega`, `camino`, and `resultado` are unchanged

#### Scenario: Failed status records an actionable reason

- **WHEN** a verified `failed` status carrying error code `131026` correlates to a gestión still
  at `DISPATCHED`
- **THEN** that gestión's `entrega` becomes `FAILED` with `deliveryReason` of
  `INVALID_DESTINATION`

#### Scenario: Opt-out is recorded on both axes

- **WHEN** a verified `failed` status carrying error code `131050` correlates to a gestión still
  at `DISPATCHED`
- **THEN** that gestión's `entrega` becomes `FAILED` with `deliveryReason` of `REJECTED`
- **AND** its `resultado` is set to `OPT_OUT`
- **AND** `channelData.optOutAt` is set to the status timestamp

#### Scenario: Opt-out behind a leading generic error code is still detected

- **WHEN** a verified `failed` status carries error codes `[131000, 131050]`
- **THEN** the gestión is treated as an opt-out
- **AND** `deliveryReason` is `REJECTED`, not the `PROVIDER_ERROR` the first code would give

#### Scenario: Opt-out does not overwrite an outcome the conversation produced

- **WHEN** a verified `failed` status carrying `131050` correlates to a gestión whose
  `resultado` is already `PAYMENT_PROMISE`
- **THEN** the `resultado` remains `PAYMENT_PROMISE`
- **AND** `channelData.optOutAt` is still set, so the block is not lost

#### Scenario: Redelivered status does not overwrite a finalized gestión

- **WHEN** a `delivered` status correlates to a gestión whose `entrega` is already `FAILED`
- **THEN** the gestión's `entrega` and `deliveryReason` are left unchanged

#### Scenario: Unverified webhook request is rejected

- **WHEN** an inbound webhook request fails signature verification
- **THEN** the request is rejected without mutating any data

#### Scenario: Quality rating callback updates the sender number

- **WHEN** a verified quality-rating callback is received for a `phoneNumberId`
- **THEN** the matching `WhatsAppSenderNumber`'s `qualityRating` is updated to the reported value

### Requirement: Inbound message correlation by canonical phone match

The system SHALL correlate an inbound WhatsApp message to the gestión (contact log entry) it is a
reply to by an exact match between the inbound sender's phone number and the destination phone
number recorded on the dispatch, both compared in canonical E.164 form. The correlation query SHALL
be a direct, indexed/exact lookup scoped to the sender number's workspace — not a bounded scan over
the workspace's recent contact logs. When the inbound sender's number cannot be parsed as a valid
phone number, the system SHALL treat the message as unmatched without querying the datastore.

#### Scenario: Inbound reply matches its dispatch by canonical phone

- **WHEN** a customer replies on WhatsApp to a number the system previously dispatched a WHATSAPP
  template to
- **THEN** the system correlates the reply to that gestión by comparing the inbound sender's E.164
  number against the dispatch's recorded destination E.164 number
- **AND** the match uses a direct query scoped to the sender number's workspace, not a scan of the
  most-recent N contact logs

#### Scenario: Unparseable inbound sender number yields no match

- **WHEN** an inbound WhatsApp message's sender number cannot be parsed as a valid phone number
- **THEN** the system treats the message as unmatched to any gestión
- **AND** does not attempt a datastore lookup for the malformed number

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
