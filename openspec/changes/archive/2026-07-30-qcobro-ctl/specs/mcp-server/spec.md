## REMOVED Requirements

### Requirement: Self-service Claude Desktop configuration

**Reason**: Superseded by `@qcobro/ctl`'s `mcp:configure` command (see the `ctl`
capability's "MCP client configuration" requirement), which consolidates Claude Desktop
(and future MCP client) configuration into the general-purpose CLI instead of a one-off
subcommand bolted onto the MCP server package itself.

**Migration**: Users running `npx @qcobro/mcp config --access-key-id <id>
--access-key-secret <secret> --workspace <workspaceAccessKeyId>` SHALL instead run
`npx @qcobro/ctl mcp:configure --access-key-id <id> --access-key-secret <secret>
--workspace <workspaceAccessKeyId>` (or, after `qcobro workspaces:login`, simply
`npx @qcobro/ctl mcp:configure` with no flags). `@qcobro/mcp`'s own `config` subcommand,
its `src/config/paths.ts` and `src/config/writeClaudeConfig.ts` helpers, and their tests
are deleted. The server's `serve` behavior and tool set are unaffected.

The following requirement's original scenarios were:

#### Scenario: Configuring with only required credentials

- **WHEN** a user runs `npx @qcobro/mcp config --access-key-id <accessKeyId>
--access-key-secret <accessKeySecret> --workspace <workspaceAccessKeyId>` without
  `--url`
- **THEN** the command writes a `qcobro` entry into Claude Desktop's config pointing at
  QCobro's default production endpoint, with the provided credentials set as environment
  variables

#### Scenario: Configuring against a custom endpoint

- **WHEN** a user runs the `config` subcommand with `--url` pointing at a non-default
  endpoint
- **THEN** the written configuration uses that endpoint instead of the default

#### Scenario: Existing Claude Desktop config is preserved

- **WHEN** a user runs the `config` subcommand and `claude_desktop_config.json` already
  exists with other MCP servers configured
- **THEN** the existing entries are preserved and only the `qcobro` entry is added or
  replaced

#### Scenario: No existing Claude Desktop config file

- **WHEN** a user runs the `config` subcommand and no `claude_desktop_config.json` exists
  yet
- **THEN** the command creates the file (and its parent directory, if needed) with a
  `qcobro` MCP server entry

#### Scenario: Missing required credential flags

- **WHEN** a user runs the `config` subcommand without `--access-key-id`,
  `--access-key-secret`, or `--workspace`
- **THEN** the command fails with a clear error naming the missing flag and does not
  write any file

These scenarios are now covered by the `ctl` capability's "MCP client configuration"
requirement, exercised against `qcobro mcp:configure` instead.
