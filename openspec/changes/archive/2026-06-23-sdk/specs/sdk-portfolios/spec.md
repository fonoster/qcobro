## ADDED Requirements

### Requirement: Portfolios namespace

The SDK `Client` SHALL expose a `portfolios` namespace whose methods map to the apiserver's
portfolio operations with friendly names and fully-typed inputs and results, without exposing the
underlying transport's `query`/`mutate` idiom. Results SHALL be typed from the server's router type.

#### Scenario: Methods are discoverable on the client

- **WHEN** a developer accesses `client.portfolios`
- **THEN** it provides `list`, `get`, `create`, `update`, `delete`, `listAccounts`, and
  `syncAccounts` methods that each return a typed promise

### Requirement: List and read portfolios

`client.portfolios.list` SHALL return the active workspace's portfolios, optionally including
archived ones. `client.portfolios.get` SHALL return a single portfolio by id within the active
workspace.

#### Scenario: List active portfolios

- **WHEN** `list()` is called in an authenticated, workspace-scoped client
- **THEN** the non-archived portfolios of the active workspace are returned

#### Scenario: Include archived portfolios

- **WHEN** `list({ includeArchived: true })` is called
- **THEN** archived portfolios are included in the result

#### Scenario: Get a portfolio by id

- **WHEN** `get({ id })` is called with an id in the active workspace
- **THEN** that portfolio is returned

### Requirement: Create, update, and delete portfolios

`client.portfolios.create`, `update`, and `delete` SHALL create, modify, and remove portfolios in the
active workspace. Updating a portfolio's archived flag SHALL archive or restore it.

#### Scenario: Create a portfolio

- **WHEN** `create({ name, clientId, currency })` is called with valid input
- **THEN** a new portfolio is created in the active workspace and returned

#### Scenario: Archive via update

- **WHEN** `update({ id, archived: true })` is called
- **THEN** the portfolio is marked archived

#### Scenario: Delete a portfolio

- **WHEN** `delete({ id })` is called for a portfolio in the active workspace
- **THEN** the portfolio is removed

### Requirement: List and synchronize accounts

`client.portfolios.listAccounts` SHALL return a page of a portfolio's accounts with a total count.
`client.portfolios.syncAccounts` SHALL synchronize a batch of account rows into a portfolio using one
of the supported modes: `APPEND_ONLY`, `UPDATE_EXISTING`, or `REPLACE`.

#### Scenario: List accounts with paging

- **WHEN** `listAccounts({ portfolioId, limit, offset })` is called
- **THEN** the matching page of accounts and the total count are returned

#### Scenario: Synchronize accounts

- **WHEN** `syncAccounts({ portfolioId, mode, rows })` is called with valid rows and a supported mode
- **THEN** the accounts are synchronized into the portfolio according to the mode

### Requirement: Client-side input validation

Before sending a request, each `portfolios` method SHALL validate its input against the shared
`@qcobro/common` schema for that operation. Invalid input SHALL be rejected with a structured
validation error and SHALL NOT result in a network request.

#### Scenario: Invalid input rejected before the request

- **WHEN** a portfolio method is called with input that violates the shared schema (e.g. an empty
  `name`, an unsupported `currency`, or an unknown sync `mode`)
- **THEN** the call rejects with a structured validation error and no request is sent to the server

#### Scenario: Valid input passes validation and is sent

- **WHEN** a portfolio method is called with input that satisfies the shared schema
- **THEN** validation passes and the request is sent to the server
