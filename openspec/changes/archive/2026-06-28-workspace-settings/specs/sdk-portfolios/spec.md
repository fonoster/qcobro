## MODIFIED Requirements

### Requirement: Create, update, and delete portfolios

`client.portfolios.create`, `update`, and `delete` SHALL create, modify, and remove portfolios in the
active workspace. Updating a portfolio's archived flag SHALL archive or restore it. A
portfolio SHALL NOT carry a currency — currency is a workspace-level setting (see
`workspace-settings`), so `create` SHALL NOT accept a `currency` argument.

#### Scenario: Create a portfolio

- **WHEN** `create({ name, clientId })` is called with valid input
- **THEN** a new portfolio is created in the active workspace and returned
- **AND** no currency is accepted or stored on the portfolio

#### Scenario: Archive via update

- **WHEN** `update({ id, archived: true })` is called
- **THEN** the portfolio is marked archived

#### Scenario: Delete a portfolio

- **WHEN** `delete({ id })` is called for a portfolio in the active workspace
- **THEN** the portfolio is removed

### Requirement: Client-side input validation

Before sending a request, each `portfolios` method SHALL validate its input against the shared
`@qcobro/common` schema for that operation. Invalid input SHALL be rejected with a structured
validation error and SHALL NOT result in a network request.

#### Scenario: Invalid input rejected before the request

- **WHEN** a portfolio method is called with input that violates the shared schema (e.g. an empty
  `name` or an unknown sync `mode`)
- **THEN** the call rejects with a structured validation error and no request is sent to the server

#### Scenario: Valid input passes validation and is sent

- **WHEN** a portfolio method is called with input that satisfies the shared schema
- **THEN** validation passes and the request is sent to the server
