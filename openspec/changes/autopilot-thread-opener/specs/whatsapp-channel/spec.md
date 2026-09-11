## MODIFIED Requirements

### Requirement: Conversational AI replies within the customer-service window

A `WHATSAPP` agent SHALL be **smart** like the `EMAIL` agent. After the templated opener, when the
customer replies the system SHALL generate a response from the agent's `systemPrompt` and send it
as a **free-form** (non-template) WhatsApp message. Free-form replies are permitted only inside
Meta's 24-hour customer-service window opened by a customer message; outside the window the system
SHALL fall back to a template and SHALL NOT send free-form text. The agent SHALL send at most
`maxReplies` replies per gestión. Each customer message and agent reply SHALL be recorded on
the gestión as a conversation thread. The agent MAY register a payment promise and MUST honor
opt-out intent expressed in the conversation.

The conversation presented to the decision step SHALL begin with the **templated opener that was
dispatched** — rendered as it was sent — as an outbound turn, so the agent can see what the
customer is replying to. The opener is recorded at dispatch outside the reply thread; it SHALL be
presented as part of the conversation without being duplicated into the stored thread.

The decision step SHALL be given the **entire** conversation on every turn: the opener followed by
every customer message and agent reply so far, oldest first. No truncation, sliding window, or
message limit SHALL be applied — the reply cap and the 24-hour window are the only bounds.

The decision step SHALL additionally be given the current date, so a relative promise ("el viernes",
"mañana") can be resolved into the absolute due date a `PaymentPromise` requires.

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

#### Scenario: The agent can answer a question about the opener

- **WHEN** the customer's first reply refers to the templated opener rather than the debt
- **THEN** the decision step sees that opener as the conversation's first turn
- **AND** the agent can answer from its content rather than from the reply alone

#### Scenario: A relative promise becomes a dated one

- **WHEN** the customer replies "le pago el viernes"
- **THEN** the decision step resolves it against the current date into an absolute `dueDate`
