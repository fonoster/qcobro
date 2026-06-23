## ADDED Requirements

### Requirement: Manual outreach from a customer row

The portfolio accounts view SHALL offer a "Contactar manualmente" action in each customer
row's actions menu (⋯). Selecting it SHALL open a modal that lets the operator:

- choose an agent template from the workspace (showing its channel type),
- optionally adjudicate the contact to a campaign,
- preview the message body rendered with that customer's data, and
- send, which dispatches the outreach and records it as a gestión.

#### Scenario: Operator sends a manual outreach to one customer

- **WHEN** an operator opens the ⋯ menu on a customer row and chooses "Contactar manualmente"
- **THEN** a modal opens to select an agent template and optionally a campaign
- **AND** the modal shows the message body rendered with the customer's data
- **AND** on send, the outreach is dispatched and a confirmation is shown

#### Scenario: Manual outreach is recorded as a gestión

- **WHEN** a manual outreach dispatch succeeds
- **THEN** a gestión is recorded for that account (carrying the campaign if one was
  adjudicated) so the contact appears in the account's outreach history
