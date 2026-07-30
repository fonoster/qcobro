# mcp-server

## Purpose

`@qcobro/mcp` — a Model Context Protocol server wrapping `@qcobro/sdk`'s `Client`, exposing the
`portfolios` resource as MCP tools for AI agents/tools (e.g. Claude Desktop) to call, authenticated
with a workspace API key exactly as the SDK is. MCP-client configuration (writing an entry into a
client's config file, e.g. Claude Desktop's) is a `@qcobro/ctl` capability (`mcp:configure`), not
part of this package — see the `ctl` spec.

## Requirements

### Requirement: MCP server authenticates with a workspace API key

The `@qcobro/mcp` server SHALL authenticate against the QCobro API using a workspace API key
(`accessKeyId` + `accessKeySecret`), via the same `loginWithApiKey` flow `@qcobro/sdk` exposes to
any other caller. It SHALL NOT implement a separate authentication mechanism or a distinct
MCP-specific permission role — the role granted to the API key by Fonoster Identity is authoritative.

#### Scenario: Server starts and authenticates with a valid key

- **WHEN** the server process starts with a valid `accessKeyId`, `accessKeySecret`, endpoint, and
  workspace configured via environment variables
- **THEN** the server authenticates via `loginWithApiKey`, selects the configured workspace, and is
  ready to serve tool calls

#### Scenario: Missing required configuration prevents startup

- **WHEN** the server process starts without one of the required environment variables (access key
  id, access key secret, or workspace)
- **THEN** the server SHALL fail fast with a clear error identifying the missing variable, rather
  than starting in a partially-configured state

#### Scenario: Invalid API key is rejected at startup

- **WHEN** the server process starts with an `accessKeySecret` that does not match the configured
  `accessKeyId`
- **THEN** startup fails with a clear authentication error, matching the SDK's own
  `loginWithApiKey` failure behavior

### Requirement: Portfolio operations are exposed as MCP tools

The server SHALL register one MCP tool per `@qcobro/sdk` `portfolios` resource method: listing
portfolios, getting a single portfolio, creating a portfolio, updating a portfolio, deleting a
portfolio, listing a portfolio's accounts, and synchronizing a portfolio's accounts. Each tool's
input schema SHALL be the same schema the corresponding SDK method validates against — no
independent validation rules are defined at the MCP layer.

#### Scenario: Listing portfolios via MCP

- **WHEN** an MCP client calls the portfolios-list tool with a valid (or empty) input
- **THEN** the tool returns the active workspace's portfolios, matching what
  `client.portfolios.list()` would return

#### Scenario: Creating a portfolio via MCP

- **WHEN** an MCP client calls the portfolios-create tool with a valid payload
- **THEN** a portfolio is created in the active workspace and the tool returns the created
  portfolio, matching what `client.portfolios.create()` would return

#### Scenario: Invalid tool input is rejected before any request is sent

- **WHEN** an MCP client calls a portfolios tool with input that fails the shared schema (e.g. a
  missing required field)
- **THEN** the tool call fails with a structured validation error and no request reaches the
  QCobro API

#### Scenario: Synchronizing accounts via MCP

- **WHEN** an MCP client calls the portfolios-sync-accounts tool with a valid batch of account rows
  and a merge mode
- **THEN** the accounts are synchronized into the target portfolio exactly as
  `client.portfolios.syncAccounts()` would perform it
