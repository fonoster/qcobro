## ADDED Requirements

### Requirement: SMS dispatch registers a Twilio status callback

Sending an `SMS` SHALL register Twilio's `statusCallback` at `<webhookBaseUrl>/api/sms/events` whenever `twilio.webhookBaseUrl` is configured, so Twilio posts every delivery-status transition back to QCobro. When no base URL is configured, SMS SHALL be sent without a `statusCallback`.

#### Scenario: Status callback registered when a base URL is configured

- **WHEN** `twilio.webhookBaseUrl` is set and an SMS is dispatched
- **THEN** the Twilio `messages.create` request includes `statusCallback` set to `<webhookBaseUrl>/api/sms/events`

#### Scenario: No status callback when no base URL is configured

- **WHEN** `twilio.webhookBaseUrl` is not set and an SMS is dispatched
- **THEN** the Twilio `messages.create` request is sent without a `statusCallback`

### Requirement: SMS status-callback endpoint is authenticated

The `POST /api/sms/events` endpoint SHALL verify that each request genuinely originated from Twilio by validating the `X-Twilio-Signature` header against the configured `authToken` and the exact callback URL before processing the request. A request that fails validation SHALL be rejected without being processed, and SHALL NOT read or write any gestión data.

#### Scenario: A validly signed request is processed

- **WHEN** `POST /api/sms/events` receives a request whose `X-Twilio-Signature` header validates against the configured `authToken` and callback URL
- **THEN** the request is processed and, if it correlates to a gestión, may update that gestión as specified in the `account-contact-log` capability

#### Scenario: An invalidly signed request is rejected

- **WHEN** `POST /api/sms/events` receives a request whose `X-Twilio-Signature` header does not validate
- **THEN** the request is rejected with an error response
- **AND** no gestión is read or written

### Requirement: SMS status-callback endpoint responds promptly regardless of correlation outcome

The `POST /api/sms/events` endpoint SHALL respond with a success status after processing a validly signed request, whether or not the callback correlates to a known gestión, so Twilio does not retry a callback that cannot resolve differently.

#### Scenario: A callback for an unknown message is acknowledged, not treated as an error

- **WHEN** a validly signed status callback's `MessageSid` does not correlate to any gestión
- **THEN** the endpoint responds with a success status
- **AND** no gestión is created or updated
