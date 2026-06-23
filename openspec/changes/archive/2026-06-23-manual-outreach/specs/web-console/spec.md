## ADDED Requirements

### Requirement: Manual outreach from a customer row

The portfolio accounts view SHALL offer a "Contactar manualmente" action in each customer
row's actions menu (the standard ⋯ row-actions menu, consistent with the campaigns and
agent-templates lists). Selecting it SHALL open a modal that lets the operator:

- select a **campaign** (required) — a manual contact runs that campaign's agent against
  this one customer,
- see which **agent and channel** will be used (derived from the selected campaign, shown
  as a note — not a separate picker),
- see a **channel-appropriate preview** of what will be sent (SMS/pre-recorded show the
  rendered message/script; Voz IA shows the rendered first message), and
- send, which dispatches the outreach and records it as a gestión of that campaign.

#### Scenario: Operator sends a manual outreach to one customer

- **WHEN** an operator opens the ⋯ menu on a customer row and chooses "Contactar manualmente"
- **THEN** a modal opens requiring the operator to select a campaign
- **AND** the agent and channel for that campaign are shown
- **AND** a channel-appropriate preview rendered with the customer's data is shown
- **AND** on send, the outreach is dispatched and a confirmation is shown

#### Scenario: Manual outreach is recorded as a gestión of the campaign

- **WHEN** a manual outreach dispatch succeeds
- **THEN** a gestión is recorded for that account carrying the selected campaign so the
  contact appears in the account's outreach history
