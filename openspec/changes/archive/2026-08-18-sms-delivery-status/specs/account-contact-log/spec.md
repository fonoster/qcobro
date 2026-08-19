## ADDED Requirements

### Requirement: SMS delivery outcome is recorded from Twilio's status callback

An `SMS` gestión left at the dispatch-time `OTHER` placeholder outcome SHALL be finalized from Twilio's message-status callback when `twilio.webhookBaseUrl` is configured. A terminal Twilio status SHALL finalize the gestión: `delivered` sets outcome `DELIVERED`; `undelivered` or `failed` sets outcome `NOT_DELIVERED`. Non-terminal statuses (`queued`, `sending`, `sent`, and any other value) SHALL NOT finalize the gestión.

Every status callback received, terminal or not, SHALL update `channelData.deliveryStatus` to the raw Twilio status, so an operator can see a message's current progress (e.g. "sent" awaiting "delivered") even before it finalizes.

Finalization SHALL be idempotent per gestión: once a gestión's outcome has left the dispatch-time `OTHER` placeholder, a subsequently received status callback SHALL NOT modify the outcome, regardless of what status it carries.

When `twilio.webhookBaseUrl` is not configured, SMS dispatch SHALL behave exactly as it does without this capability: fire-and-forget, with no delivery-status update of any kind.

#### Scenario: Delivered SMS is finalized

- **WHEN** Twilio's status callback reports `delivered` for a message whose gestión is still at the `OTHER` placeholder
- **THEN** the gestión `outcome` is set to `DELIVERED`
- **AND** `channelData.deliveryStatus` is set to `delivered`

#### Scenario: Undelivered or failed SMS is finalized

- **WHEN** Twilio's status callback reports `undelivered` or `failed` for a message whose gestión is still at the `OTHER` placeholder
- **THEN** the gestión `outcome` is set to `NOT_DELIVERED`
- **AND** `channelData.deliveryStatus` is set to the reported status

#### Scenario: An interim status updates visibility without finalizing

- **WHEN** Twilio's status callback reports `queued`, `sending`, or `sent`
- **THEN** `channelData.deliveryStatus` is updated to that status
- **AND** the gestión `outcome` remains the `OTHER` placeholder

#### Scenario: A callback after finalization never changes the outcome

- **WHEN** a gestión has already been finalized (its outcome has left the `OTHER` placeholder)
- **THEN** a subsequently received status callback for the same message, terminal or otherwise, SHALL NOT modify the gestión's outcome

#### Scenario: SMS remains fire-and-forget when the webhook is not configured

- **WHEN** `twilio.webhookBaseUrl` is not set
- **THEN** SMS dispatch proceeds exactly as it does today — no `statusCallback` is registered with Twilio, and the gestión's outcome is never updated after dispatch
