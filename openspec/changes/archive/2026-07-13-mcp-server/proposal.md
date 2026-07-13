## Why

AI agents and agentic tooling (coding assistants, ops agents) increasingly integrate with services
through the Model Context Protocol rather than bespoke API glue. QCobro has a typed, well-scoped API
surface (`@qcobro/sdk`) but no MCP server, so today any agent-driven workflow (querying portfolios,
inspecting accounts, kicking off a sync) requires custom integration work instead of a discoverable,
standard interface. GitHub issue fonoster/qcobro#16 asks to close that gap.

## What Changes

- Add a new publishable package `@qcobro/mcp` (`mods/mcp`) implementing a stdio MCP server that
  wraps `@qcobro/sdk`'s `Client`, authenticating with a workspace API key (accessKeyId +
  accessKeySecret) exactly as the SDK does — no new auth mechanism.
- Expose the `portfolios` resource the SDK already wraps as MCP tools: list, get, create, update,
  delete, listAccounts, syncAccounts. No other resource is exposed in v1.
- Add a `config` CLI subcommand bundled in the same package (`npx @qcobro/mcp config --url <endpoint>
--access-key-id <accessKeyId> --access-key-secret <accessKeySecret> --workspace
<workspaceAccessKeyId>`) that writes/merges Claude Desktop's
  `claude_desktop_config.json` on macOS/Windows so a user can self-configure the MCP server without
  hand-editing JSON. `--url` defaults to the SDK's existing default endpoint
  (`https://api.qcobro.com`).
- Document setup (README in `mods/mcp` + a docs page) covering the tool list, required
  environment variables, and the `config` helper.

Out of scope for this change (explicitly deferred, per the originating issue's open questions):

- Any new limited-permission MCP role or auth-scoping mechanism in Fonoster Identity — the API key's
  role is assumed to already exist and is transparent to this work.
- Tools for resources the SDK does not yet wrap (campaigns, outreach, API keys, billing, gestiones).
- Config helpers for MCP clients other than Claude Desktop.
- Rate limiting or MCP-specific audit logging beyond what the API/Identity already provide.

## Capabilities

### New Capabilities

- `mcp-server`: the `@qcobro/mcp` package — server startup/auth/tool registration, the portfolio
  tool surface, and the `config` subcommand for self-service Claude Desktop setup.

### Modified Capabilities

(none — this change adds a new client package on top of existing, unchanged `sdk-client` and
`sdk-portfolios` behavior; it does not alter apiserver, api-keys, or SDK requirements.)

## Impact

- **New**: `mods/mcp` package (`@qcobro/mcp`), added as a workspace under `mods/*`.
- **Dependency**: `mods/mcp` depends on `@qcobro/sdk` and `@qcobro/common` (existing packages,
  unchanged) plus the new `@modelcontextprotocol/sdk` dependency.
- **No changes** to `mods/apiserver`, `mods/webapp`, `mods/common` schemas, or `mods/sdk`'s public
  API — this change only adds a new consumer of the existing SDK.
- **Docs**: new README under `mods/mcp` and a docs page (Mintlify) explaining setup and usage.
