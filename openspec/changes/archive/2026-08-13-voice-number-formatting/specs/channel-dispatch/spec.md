## MODIFIED Requirements

### Requirement: Outreach bodies are Handlebars templates rendered per customer

Agent-template message bodies SHALL be treated as Handlebars templates and rendered against
the target customer's account before dispatch. The render context SHALL expose the
customer's `PortfolioAccount` fields plus derived values: `firstName` (first token of
`fullName`) and `currency` (the **workspace's** currency from `WorkspaceSettings`).

Money-typed account fields — `outstandingBalance`, `principalAmount`, `termsAmount` and
`lastPaymentAmount` — SHALL be exposed as amounts formatted for the workspace's `locale`
(from `WorkspaceSettings`), including grouping separators. Count-typed fields —
`daysPastDue`, `missedInstallments` and `termsLength` — SHALL be exposed unformatted. This
formatting is not opt-in: a template referencing `{{outstandingBalance}}` receives the
formatted amount with no additional syntax.

Rendering SHALL NOT HTML-escape (bodies are plain text / voice script / SMS), and an unknown
or missing field SHALL render as empty rather than aborting the dispatch.

The templated bodies are: Voz IA `firstMessage` and `systemPrompt`, pre-recorded `script`,
and SMS `messageBody`.

#### Scenario: Body is personalized with account data

- **WHEN** an SMS body `"Hola {{firstName}}, su saldo es {{outstandingBalance}} {{currency}}"`
  is dispatched to an account named "María López" with outstanding balance 1500 in a workspace
  whose currency is `DOP` and whose locale groups thousands with a comma
- **THEN** the rendered body is `"Hola María, su saldo es 1,500 DOP"`

#### Scenario: Money formatting follows the workspace locale

- **WHEN** the same body is dispatched from a workspace whose locale groups thousands with a
  period
- **THEN** the rendered body is `"Hola María, su saldo es 1.500 DOP"`

#### Scenario: Counts are not formatted as amounts

- **WHEN** a body references `{{daysPastDue}}` for an account 1200 days past due
- **THEN** it renders as `1200`, with no grouping separator

#### Scenario: Missing field renders empty, dispatch proceeds

- **WHEN** a body references `{{unknownField}}` for an account that has no such value
- **THEN** that placeholder renders as an empty string
- **AND** the dispatch still proceeds with the rest of the rendered body

## ADDED Requirements

### Requirement: Numeric template helpers operate on formatted amounts

Template helpers SHALL interpret an operand that is a locale-formatted amount as its
underlying numeric value, so that formatting money-typed fields does not change any
template's arithmetic or branching. This applies to `multiply`, `eq`, `gt`, `gte`, `ge`, `lt`
and `lte`. Parsing SHALL follow the workspace's locale, since the grouping and decimal
separators differ between locales.

`multiply` SHALL format its result the same way money-typed fields are formatted, so a
computed amount reads aloud like a stored one.

An operand that is neither a number nor a parseable formatted amount SHALL continue to behave
as it does today: `multiply` yields `0`, and comparisons yield false.

#### Scenario: Settlement offer still computes

- **WHEN** a body contains `{{multiply outstandingBalance 0.5}}` for an account with an
  outstanding balance of 9500 in a workspace whose locale groups thousands with a comma
- **THEN** it renders `4,750`

#### Scenario: Comparison branches on the underlying amount

- **WHEN** a body contains `{{#if (gte outstandingBalance 1000)}}` for an account with an
  outstanding balance of 9500
- **THEN** the condition is true

#### Scenario: Non-numeric operand is inert

- **WHEN** a body contains `{{multiply customerSegment 2}}`
- **THEN** it renders `0` and the dispatch proceeds

### Requirement: Digit-by-digit template helper

Templates SHALL provide a `digits` helper that renders a value's digits separated by single
spaces, so text-to-speech reads them one at a time rather than as a single quantity. Non-digit
characters in the value SHALL be dropped. An empty or missing value SHALL render as an empty
string rather than aborting the dispatch.

#### Scenario: Phone number is spelled out

- **WHEN** a pre-recorded script contains `{{digits phone}}` for an account whose phone is
  `8092323333`
- **THEN** it renders `8 0 9 2 3 2 3 3 3 3`

#### Scenario: Formatting characters are dropped

- **WHEN** the account's phone is stored as `+1 (809) 232-3333`
- **THEN** `{{digits phone}}` renders `1 8 0 9 2 3 2 3 3 3 3`

#### Scenario: Missing value renders empty

- **WHEN** a script contains `{{digits externalId}}` for an account with no external id
- **THEN** it renders as an empty string and the dispatch proceeds
