## MODIFIED Requirements

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
- `failed` → `entrega` of `FAILED`, with `deliveryReason` derived from Meta's error code:
  `131026` (undeliverable) SHALL be `INVALID_DESTINATION`; `131047` (outside the re-engagement
  window), `131048` and `131049` (spam and per-user quality limits), and `131050` (user opted
  out) SHALL be `REJECTED`; any other or absent code SHALL be `PROVIDER_ERROR`
- `sent` → `channelData.deliveryStatus` visibility only, moving no axis

A `read` receipt SHALL NOT set `camino` or `resultado`, and SHALL NOT by itself advance
`entrega`. Every status SHALL record its raw value in `channelData.deliveryStatus`, terminal or
not.

When a status indicates a customer block or opt-out (a `failed` status carrying error code
`131050`), the system SHALL additionally set the gestión's `resultado` to `OPT_OUT`, recording
the signal where an operator can find it. This SHALL NOT be treated as enforced suppression,
which belongs to the workspace Do Not Contact list.

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

#### Scenario: Redelivered status does not overwrite a finalized gestión

- **WHEN** a `delivered` status correlates to a gestión whose `entrega` is already `FAILED`
- **THEN** the gestión's `entrega` and `deliveryReason` are left unchanged

#### Scenario: Unverified webhook request is rejected

- **WHEN** an inbound webhook request fails signature verification
- **THEN** the request is rejected without mutating any data

#### Scenario: Quality rating callback updates the sender number

- **WHEN** a verified quality-rating callback is received for a `phoneNumberId`
- **THEN** the matching `WhatsAppSenderNumber`'s `qualityRating` is updated to the reported value
