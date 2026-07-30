# ctl Specification

## Purpose

`@qcobro/ctl` — the QCobro command-line tool. An oclif CLI built on `@qcobro/sdk` giving
developers resource-scoped commands (`resource:action`) for common operations — workspace
login, portfolio sync/list/get, agent template create/eval, and configuring an MCP client
(e.g. Claude Desktop) to use `@qcobro/mcp` — without going through the operator console.

## Requirements

### Requirement: CLI is installable as a `qcobro` bin

`@qcobro/ctl` SHALL be an oclif-based CLI package that installs a `qcobro` executable,
with `:` as the topic separator (resource:action command shape, e.g. `portfolios:list`),
and SHALL warn the user when a newer version is available.

#### Scenario: Running the CLI with no arguments shows help

- **WHEN** a developer runs `qcobro` with no arguments
- **THEN** the CLI prints its command topics and usage, matching oclif's default help
  behavior

#### Scenario: A newer version is available

- **WHEN** the installed `@qcobro/ctl` version is more than 7 days older than the latest
  published version
- **THEN** the CLI prints an update-available notice without blocking the command

### Requirement: Shared BaseCommand and AuthenticatedCommand

Every command SHALL extend `BaseCommand`, which provides shared flag parsing and error
handling. Commands that need an authenticated SDK client SHALL extend
`AuthenticatedCommand`, which SHALL construct a `@qcobro/sdk` `Client` from the active
workspace's stored credentials, authenticate with `loginWithApiKey`, and select the
workspace with `useWorkspace` before the command body runs.

#### Scenario: Authenticated command with no active workspace

- **WHEN** a command extending `AuthenticatedCommand` runs and no workspace is configured
  (or none is marked active)
- **THEN** the command fails with a clear error instructing the user to run
  `qcobro workspaces:login`, and no SDK client is constructed

#### Scenario: Authenticated command builds a client from the active workspace

- **WHEN** a command extending `AuthenticatedCommand` runs and an active workspace is
  configured
- **THEN** an SDK `Client` is constructed against that workspace's `endpoint`, logged in
  with its `accessKeyId`/`accessKeySecret`, and scoped to its `workspaceAccessKeyId`

### Requirement: Workspace login and local config

`qcobro workspaces:login` SHALL prompt for an endpoint (defaulting to QCobro's production
API), a workspace API key (`accessKeyId` + `accessKeySecret`), and the target workspace's
`accessKeyId`, validate them with a live request, and persist them to a local config file
at `~/.qcobro/config.json`. Adding a workspace SHALL deactivate any previously active
workspace and mark the new one active. `qcobro workspaces:list` SHALL list configured
workspaces; `qcobro workspaces:use` SHALL switch the active workspace;
`qcobro workspaces:active` SHALL print the active one; `qcobro workspaces:logout` SHALL
remove a configured workspace.

#### Scenario: Successful login persists and activates a workspace

- **WHEN** a developer completes `workspaces:login` with valid credentials and confirms
- **THEN** the workspace is validated against the API, written to
  `~/.qcobro/config.json`, and marked active

#### Scenario: Logging in a second workspace deactivates the first

- **WHEN** a developer runs `workspaces:login` again for a different workspace
- **THEN** the previously active workspace is marked inactive and the new one becomes
  active

#### Scenario: Invalid workspace config is rejected before it's saved

- **WHEN** `workspaces:login` (or any code path adding a workspace) is given a malformed
  workspace config (e.g. a missing `accessKeySecret` or empty `endpoint`)
- **THEN** the operation throws a structured validation error and `~/.qcobro/config.json`
  is left unchanged

#### Scenario: Switching the active workspace

- **WHEN** a developer runs `workspaces:use <workspaceAccessKeyId>` for a previously
  logged-in workspace
- **THEN** that workspace becomes active and all other configured workspaces become
  inactive

### Requirement: Portfolio commands

`qcobro portfolios:sync`, `portfolios:list`, and `portfolios:get` SHALL wrap
`client.portfolios.syncAccounts`, `client.portfolios.list`, and `client.portfolios.get`
respectively, using the active workspace's authenticated client.

#### Scenario: Syncing a portfolio's accounts from a file

- **WHEN** a developer runs `portfolios:sync --portfolio-id <id> --file <rows.json> --mode
<mode>`
- **THEN** the CLI reads and parses the file, calls `client.portfolios.syncAccounts` with
  the portfolio id, mode, and parsed rows, and reports the result

#### Scenario: Listing portfolios

- **WHEN** a developer runs `portfolios:list`
- **THEN** the CLI prints the active workspace's portfolios in a table

#### Scenario: Getting a single portfolio

- **WHEN** a developer runs `portfolios:get <id>`
- **THEN** the CLI prints that portfolio's details

### Requirement: Agent template commands

`qcobro agents:create` SHALL wrap `client.agentTemplates.create`, accepting the agent
type and its type-specific fields as flags. `qcobro agents:eval` SHALL wrap
`client.agentTemplates.sync` for a given template id, reporting whether the template's
configuration re-synced successfully with Fonoster (its `fonosterAppRef` and sync
outcome) — QCobro has no conversational-intelligence evaluation feature, so `eval`
validates configuration/sync status, not conversation behavior, and its help text SHALL
say so.

#### Scenario: Creating a VOICE_AI agent template

- **WHEN** a developer runs `agents:create --type VOICE_AI --name <name> --voice <voice>
--system-prompt <prompt> --language <lang>`
- **THEN** the CLI calls `client.agentTemplates.create` with a `VOICE_AI` payload and
  prints the created template

#### Scenario: Evaluating (re-syncing) an agent template

- **WHEN** a developer runs `agents:eval <templateId>`
- **THEN** the CLI calls `client.agentTemplates.sync({ id: templateId })` and prints the
  resulting sync status (synced / not synced) and `fonosterAppRef` when present

### Requirement: MCP client configuration

`qcobro mcp:configure` SHALL write or merge a `qcobro` MCP server entry into a supported
MCP client's configuration file (Claude Desktop by default), using either the active
workspace's stored credentials or explicit `--access-key-id`/`--access-key-secret`/
`--workspace`/`--url` flag overrides. This command supersedes `@qcobro/mcp`'s removed
`config` subcommand.

#### Scenario: Configuring from the active workspace

- **WHEN** a developer with an active workspace runs `mcp:configure`
- **THEN** the CLI writes a `qcobro` entry into Claude Desktop's config using that
  workspace's endpoint and credentials, preserving any other configured MCP servers

#### Scenario: Configuring with explicit flags and no active workspace

- **WHEN** a developer runs `mcp:configure --access-key-id <id> --access-key-secret
<secret> --workspace <workspaceAccessKeyId>` with no workspace logged in
- **THEN** the CLI writes the entry using the provided flags, without requiring
  `workspaces:login` first

#### Scenario: Missing credentials and no active workspace

- **WHEN** a developer runs `mcp:configure` with no active workspace and no credential
  flags
- **THEN** the command fails with a clear error and writes no file
