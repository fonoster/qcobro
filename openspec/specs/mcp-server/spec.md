# mcp-server

## Purpose

`@qcobro/mcp` — a Model Context Protocol server wrapping `@qcobro/sdk`'s `Client`, exposing the
`portfolios` resource as MCP tools for AI agents/tools (e.g. Claude Desktop) to call, authenticated
with a workspace API key exactly as the SDK is. Includes a `config` CLI subcommand for self-service
Claude Desktop setup.

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

### Requirement: Self-service Claude Desktop configuration

The `@qcobro/mcp` package SHALL provide a `config` CLI subcommand that writes or merges an
`mcpServers` entry for QCobro into Claude Desktop's configuration file, given an endpoint URL and a
workspace API key. The endpoint SHALL default to QCobro's production API endpoint when not
specified.

#### Scenario: Configuring with only required credentials

- **WHEN** a user runs `npx @qcobro/mcp config --access-key-id <accessKeyId> --access-key-secret
<accessKeySecret> --workspace <workspaceAccessKeyId>` without `--url`
- **THEN** the command writes a `qcobro` entry into Claude Desktop's config pointing at QCobro's
  default production endpoint, with the provided credentials set as environment variables

#### Scenario: Configuring against a custom endpoint

- **WHEN** a user runs the `config` subcommand with `--url` pointing at a non-default endpoint
- **THEN** the written configuration uses that endpoint instead of the default

#### Scenario: Existing Claude Desktop config is preserved

- **WHEN** a user runs the `config` subcommand and `claude_desktop_config.json` already exists with
  other MCP servers configured
- **THEN** the existing entries are preserved and only the `qcobro` entry is added or replaced

#### Scenario: No existing Claude Desktop config file

- **WHEN** a user runs the `config` subcommand and no `claude_desktop_config.json` exists yet
- **THEN** the command creates the file (and its parent directory, if needed) with a `qcobro` MCP
  server entry

#### Scenario: Missing required credential flags

- **WHEN** a user runs the `config` subcommand without `--access-key-id`, `--access-key-secret`, or
  `--workspace`
- **THEN** the command fails with a clear error naming the missing flag and does not write any file
