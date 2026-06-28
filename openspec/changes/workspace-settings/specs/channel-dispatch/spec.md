## MODIFIED Requirements

### Requirement: Outreach bodies are Handlebars templates rendered per customer

Agent-template message bodies SHALL be treated as Handlebars templates and rendered against
the target customer's account before dispatch. The render context SHALL expose the
customer's `PortfolioAccount` fields plus derived values: `firstName` (first token of
`fullName`) and `currency` (the **workspace's** currency from `WorkspaceSettings`).

Rendering SHALL NOT HTML-escape (bodies are plain text / voice script / SMS), and an unknown
or missing field SHALL render as empty rather than aborting the dispatch.

The templated bodies are: Voz IA `firstMessage` and `systemPrompt`, pre-recorded `script`,
and SMS `messageBody`.

#### Scenario: Body is personalized with account data

- **WHEN** an SMS body `"Hola {{firstName}}, su saldo es {{outstandingBalance}} {{currency}}"`
  is dispatched to an account named "María López" with outstanding balance 1500 in a workspace
  whose currency is `DOP`
- **THEN** the rendered body is `"Hola María, su saldo es 1500 DOP"`

#### Scenario: Missing field renders empty, dispatch proceeds

- **WHEN** a body references `{{unknownField}}` for an account that has no such value
- **THEN** the field renders as empty and the dispatch proceeds
