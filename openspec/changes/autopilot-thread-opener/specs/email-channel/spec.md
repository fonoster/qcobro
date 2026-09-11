## MODIFIED Requirements

### Requirement: EMAIL autopilot decision loop

On each correlated inbound reply, the system SHALL run the EMAIL agent as an autopilot: a
decision step over the thread and account context, governed by the agent `systemPrompt`,
producing a structured action — `reply`, `ignore`, `resolve`, or `escalate`. When the
action is `reply`, the system SHALL generate a reply, send it via the provider, and append
it to the thread. When the action is `resolve` or `escalate`, the system SHALL stop
auto-replying. Outcome and `PaymentPromise` capture from the thread SHALL reuse the existing
insight path: a real outcome SHALL NOT be downgraded, and re-delivered webhooks SHALL NOT
create duplicate `PaymentPromise`s.

The thread presented to the decision step SHALL begin with the collection notice that was
dispatched to the customer — its subject and body — as an outbound turn, so the agent can see what
the customer is replying to. The notice is recorded at dispatch outside the reply thread; it SHALL
be presented as part of the conversation without being duplicated into the stored thread.

The decision step SHALL be given the **entire** conversation on every turn: the notice followed by
every inbound and outbound message so far, oldest first. No truncation, sliding window, or message
limit SHALL be applied — the reply cap is the only bound on conversation length.

When the agent sends a reply, its subject SHALL be derived from the subject the customer replied
under, falling back to the subject of the dispatched notice.

#### Scenario: A promise is captured and acknowledged

- **WHEN** the customer's reply states an intent to pay
- **THEN** the decision is `reply` with a `PAYMENT_PROMISE` outcome and a `PaymentPromise`
- **AND** an acknowledgement reply is sent and threaded
- **AND** re-delivery of the same inbound event does not create a second `PaymentPromise`

#### Scenario: Resolve stops the conversation

- **WHEN** the decision is `resolve` (e.g. the debt is settled or intent is met)
- **THEN** the outcome/suppression is set and no further auto-reply is sent

#### Scenario: The agent can answer a question about the notice

- **WHEN** the customer's first reply refers to the notice rather than the debt
  (e.g. "¿de qué trata esto?", or a question about something stated only in that message)
- **THEN** the decision step sees the notice as the conversation's first turn
- **AND** the agent can answer from its content rather than from the reply alone

#### Scenario: Nothing is dropped as the conversation grows

- **WHEN** a third inbound reply arrives on a thread that already carries the notice, two earlier
  customer messages and two agent replies
- **THEN** the decision step is given all six messages plus the new one, in order

#### Scenario: A reply keeps the subject the customer saw

- **WHEN** an inbound reply carries no subject of its own
- **THEN** the agent's reply is sent under the subject of the dispatched notice

### Requirement: Outbound email dispatch via Resend

The system SHALL send EMAIL outreach through an injected email provider client (Resend),
rendering the agent's subject and message body against the account context before sending.
Each send SHALL set a unique per-attempt reply-to address carrying an opaque token, and the
dispatch SHALL return that token as the gestión `providerRef` for later correlation. The
provider client SHALL be injected so tests use an emulator and no live email is sent.

The dispatch SHALL additionally persist the provider's own message id, returned by the send
call, as the gestión's `providerMessageId`. This is a second correlation key and SHALL NOT
replace `providerRef`: inbound replies correlate on the reply-to token, while outbound delivery
events carry only the provider message id. A send whose provider returns no message id SHALL
still record the gestión, with `providerMessageId` left null.

The dispatch SHALL record the **rendered** subject and body actually sent on the gestión, for both
campaign-driven and manual dispatch. These are what the autopilot and the console read back as the
message the customer received.

#### Scenario: Collection notice is sent

- **WHEN** the engine dispatches an EMAIL campaign for an eligible account
- **THEN** the rendered subject and body are sent via the provider from the agent's
  `fromName`/`fromEmail`
- **AND** a unique reply-to token is set and stored as the gestión `providerRef`
- **AND** the provider's message id is stored as the gestión `providerMessageId`
- **AND** the rendered subject and body are recorded on the gestión
- **AND** exactly one gestión is recorded for the attempt

#### Scenario: Provider failure consumes the attempt

- **WHEN** the provider send fails after the attempt is reserved
- **THEN** the attempt stays consumed (at-most-once) and no gestión outcome is recorded
- **AND** the failure reason is surfaced in logs, not silently swallowed
