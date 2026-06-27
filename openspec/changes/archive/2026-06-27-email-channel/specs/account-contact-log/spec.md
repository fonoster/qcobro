## ADDED Requirements

### Requirement: Email thread on the gestión

A gestión recorded for an EMAIL collection attempt SHALL carry an ordered email thread —
each message with its direction (outbound/inbound), sender, timestamp, body, and message id
— plus the count of autopilot replies sent on that thread. The thread SHALL be enriched in
place by inbound replies and by autopilot replies, all correlated to the gestión by its
`providerRef`. The gestión outcome SHALL reflect the latest thread state and SHALL NOT
downgrade a previously recorded real outcome.

#### Scenario: Inbound and autopilot messages are threaded

- **WHEN** an inbound reply is correlated and the autopilot sends a response
- **THEN** both messages are appended to the gestión's email thread in order
- **AND** the autopilot reply count is incremented

#### Scenario: Outcome is never downgraded by a later message

- **WHEN** a later inbound message would imply a weaker/`OTHER` outcome
- **AND** a real outcome (e.g. `PAYMENT_PROMISE`) was already recorded
- **THEN** the recorded outcome is preserved
