## ADDED Requirements

### Requirement: WhatsApp campaign references an explicit sender number

A campaign whose agent template is of type `WHATSAPP` SHALL reference exactly one
`WhatsAppSenderNumber` owned by the same workspace, stored as `whatsAppSenderNumberId`. The sender
is chosen explicitly per campaign — it SHALL NOT be picked at random from a pool — because WhatsApp
quality rating and conversation continuity are per-number and different campaigns may use different
sender identities. Campaigns whose template is not `WHATSAPP` SHALL NOT carry a sender number.

#### Scenario: WhatsApp campaign requires a sender number

- **WHEN** an operator creates a campaign with a `WHATSAPP` agent template but selects no sender
  number
- **THEN** the system SHALL reject the request with a validation error

#### Scenario: Sender number must belong to the active workspace

- **WHEN** an operator creates a WhatsApp campaign referencing a `WhatsAppSenderNumber` not owned
  by the active workspace
- **THEN** the system SHALL reject the request with a validation error

#### Scenario: Non-WhatsApp campaign carries no sender number

- **WHEN** an operator creates a campaign whose template is `SMS`, `EMAIL`, or a voice type
- **THEN** the campaign SHALL be created with no `whatsAppSenderNumberId`
