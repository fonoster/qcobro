## MODIFIED Requirements

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

#### Scenario: Collection notice is sent

- **WHEN** the engine dispatches an EMAIL campaign for an eligible account
- **THEN** the rendered subject and body are sent via the provider from the agent's
  `fromName`/`fromEmail`
- **AND** a unique reply-to token is set and stored as the gestión `providerRef`
- **AND** the provider's message id is stored as the gestión `providerMessageId`
- **AND** exactly one gestión is recorded for the attempt

#### Scenario: Provider failure consumes the attempt

- **WHEN** the provider send fails after the attempt is reserved
- **THEN** the attempt stays consumed (at-most-once) and no gestión outcome is recorded
- **AND** the failure reason is surfaced in logs, not silently swallowed

### Requirement: Resend configuration

The system SHALL read a `resend` block from `qcobro.json` providing the API key, sending
domain/from address, the inbound reply domain, the webhook signing secret, per-minute send
pacing, and a default reply cap. EMAIL dispatch, inbound reply ingestion, and outbound event
ingestion SHALL be inert when the block is absent (the engine reports EMAIL as not configured
rather than erroring).

There SHALL be a single webhook signing secret. Both directions arrive on one endpoint, so
adding delivery-event ingestion SHALL require no new configuration key.

#### Scenario: Email is inert without configuration

- **WHEN** the `resend` block is absent and an EMAIL campaign is active
- **THEN** the engine skips it as not-configured and sends nothing

#### Scenario: Event ingestion is inert without configuration

- **WHEN** the `resend` block is absent and an outbound email event is posted
- **THEN** the endpoint responds 503 and no gestión is modified

#### Scenario: Enabling delivery signals needs no configuration change

- **WHEN** a deployment already configured for inbound replies upgrades to a build that ingests
  delivery events
- **THEN** no new key is required in its `resend` block for those events to be accepted
