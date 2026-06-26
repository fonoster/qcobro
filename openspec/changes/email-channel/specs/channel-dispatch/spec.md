## ADDED Requirements

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
