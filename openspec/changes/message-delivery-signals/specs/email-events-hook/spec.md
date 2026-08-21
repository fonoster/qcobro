## ADDED Requirements

### Requirement: Outbound email events endpoint is authenticated

The system SHALL expose `POST /api/email/events` for Resend's outbound email event webhook,
separate from the inbound-reply endpoint. When `resend.eventsSigningSecret` is configured, the
endpoint SHALL verify the Svix HMAC-SHA256 signature over
`{svix-id}.{svix-timestamp}.{rawBody}` using a timing-safe comparison, and SHALL reject
unverified requests with 401 without mutating any data. The endpoint SHALL be inert (503) when
the `resend` block is absent.

#### Scenario: Unsigned request is rejected

- **WHEN** `eventsSigningSecret` is configured and a request arrives with a missing or invalid
  `svix-signature`
- **THEN** the endpoint responds 401 and no gestión is modified

#### Scenario: Endpoint is inert without Resend configuration

- **WHEN** the `resend` block is absent and an event is posted
- **THEN** the endpoint responds 503 and no gestión is modified

### Requirement: Email delivery events advance the gestión's entrega

The system SHALL correlate each outbound email event to a gestión by Resend's `data.email_id`,
matched against the gestión's stored `providerMessageId` with `agentType` of `EMAIL`. A matched
event SHALL map to `entrega` as follows:

- `email.delivered` → `DELIVERED`
- `email.bounced` → `FAILED`, with `deliveryReason` derived from Resend's `bounce.type` and
  `bounce.subType`: a `Permanent` bounce of subtype `Suppressed` SHALL be `REJECTED`, any other
  `Permanent` bounce SHALL be `INVALID_DESTINATION`, and any `Transient` bounce SHALL be
  `UNREACHABLE`
- `email.failed` → `FAILED` with `PROVIDER_ERROR`
- `email.complained` → `DELIVERED`, because a spam complaint proves the message was received

Any bounce whose type or subtype is absent or unrecognized SHALL fall back to `PROVIDER_ERROR`.
`DELIVERED` SHALL mean only that the receiving mail server accepted the message; it SHALL NOT be
construed or displayed as proof the account holder read it or that the message reached the
inbox rather than a spam folder.

Every event SHALL record its raw provider status in `channelData.deliveryStatus`, terminal or
not, so an operator can see progress before the gestión finalizes. Non-terminal events
(`email.sent`, `email.delivery_delayed`) SHALL update visibility only and SHALL NOT move any
axis.

#### Scenario: Delivered event advances entrega

- **WHEN** a verified `email.delivered` event correlates to a gestión still at `DISPATCHED`
- **THEN** that gestión's `entrega` becomes `DELIVERED`
- **AND** `channelData.deliveryStatus` records the raw event type

#### Scenario: Permanent bounce records an actionable reason

- **WHEN** a verified `email.bounced` event with `bounce.type` of `Permanent` and `bounce.subType`
  of `NoEmail` correlates to a gestión still at `DISPATCHED`
- **THEN** that gestión's `entrega` becomes `FAILED` with `deliveryReason` of
  `INVALID_DESTINATION`

#### Scenario: Transient bounce is marked retryable

- **WHEN** a verified `email.bounced` event with `bounce.type` of `Transient` correlates to a
  gestión still at `DISPATCHED`
- **THEN** that gestión's `entrega` becomes `FAILED` with `deliveryReason` of `UNREACHABLE`

#### Scenario: Non-terminal event updates visibility only

- **WHEN** a verified `email.delivery_delayed` event correlates to a gestión at `DISPATCHED`
- **THEN** `channelData.deliveryStatus` is updated
- **AND** `entrega` remains `DISPATCHED` and no `deliveryReason` is set

### Requirement: Email opens record a read receipt without moving an axis

The system SHALL record `channelData.openedAt` from an `email.opened` event, set once on the
first open so it records when the message was first read. An open SHALL NOT set `camino`, SHALL
NOT set `resultado`, and SHALL NOT by itself advance `entrega`.

Read-but-unengaged is deliberately not modelled as an axis value: email open tracking is a
tracking-pixel signal that image proxies inflate and blocked images suppress. `openedAt` is
display-only and SHALL feed no metric.

#### Scenario: Open records a read receipt

- **WHEN** a verified `email.opened` event correlates to a gestión
- **THEN** `channelData.openedAt` is set to the event timestamp
- **AND** `camino` and `resultado` remain unchanged

#### Scenario: Repeated opens keep the first timestamp

- **WHEN** a second `email.opened` event correlates to a gestión that already has
  `channelData.openedAt`
- **THEN** the existing `openedAt` value is preserved

### Requirement: A spam complaint records an opt-out marker

The system SHALL set `resultado` to `OPT_OUT` on an `email.complained` event, alongside the
`entrega` of `DELIVERED` the complaint proves. This records the signal where an operator can
find it; it SHALL NOT be treated as enforced suppression, which belongs to the workspace Do Not
Contact list.

#### Scenario: Complaint marks the gestión

- **WHEN** a verified `email.complained` event correlates to a gestión
- **THEN** that gestión's `resultado` is set to `OPT_OUT`
- **AND** its `entrega` is `DELIVERED`

### Requirement: Entrega only ever advances and correlation failures are acknowledged

Once a gestión has left `DISPATCHED`, no later email event SHALL return it to `DISPATCHED` or
change it between `DELIVERED` and `FAILED`. This SHALL hold for redelivered webhooks, for events
arriving out of order, and for the race in which a customer reply has already set `DELIVERED`.

The endpoint SHALL respond 200 once the signature is valid, including when the event correlates
to no known gestión, since a redelivery cannot resolve differently. Every event SHALL be
recorded as a `provider.event` for the flight recorder, matched or not.

#### Scenario: Redelivered event does not overwrite a finalized gestión

- **WHEN** an `email.delivered` event correlates to a gestión whose `entrega` is already `FAILED`
- **THEN** the gestión's `entrega` and `deliveryReason` are left unchanged

#### Scenario: Reply already advanced the gestión

- **WHEN** a customer reply has set `entrega` to `DELIVERED` and an `email.bounced` event for the
  same gestión arrives afterwards
- **THEN** the gestión stays `DELIVERED` with no `deliveryReason`

#### Scenario: Uncorrelated event is acknowledged

- **WHEN** a verified event carries an `email_id` matching no gestión
- **THEN** the endpoint responds 200
- **AND** the event is recorded as an unmatched `provider.event`
