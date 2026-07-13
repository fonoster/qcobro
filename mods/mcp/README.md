# @qcobro/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for the [QCobro](https://qcobro.com)
API. It wraps [`@qcobro/sdk`](../sdk) so an MCP-capable client (Claude Desktop, or any other MCP
host) can list, create, and manage portfolios on your behalf.

This release covers the **portfolios** resource — the same one `@qcobro/sdk` wraps today. More
tools land as the SDK grows more resources.

## Setup

You'll need a workspace API key (an `accessKeyId` + `accessKeySecret`) — create one from the
QCobro console's API Keys page. The key's role (granted by Fonoster Identity) fully controls what
this server can do: mint a key you're comfortable handing to an agent.

### One-command setup for Claude Desktop

```bash
npx @qcobro/mcp config \
  --access-key-id <accessKeyId> \
  --access-key-secret <accessKeySecret> \
  --workspace <workspaceAccessKeyId>
```

This writes (or merges into) Claude Desktop's `claude_desktop_config.json`, adding a `qcobro`
entry. Restart Claude Desktop afterward. Pass `--url` to target a non-default endpoint (defaults
to `https://api.qcobro.com`).

### Manual setup

Add the following to `claude_desktop_config.json` yourself:

```json
{
  "mcpServers": {
    "qcobro": {
      "command": "npx",
      "args": ["-y", "@qcobro/mcp@latest"],
      "env": {
        "QCOBRO_ENDPOINT": "https://api.qcobro.com",
        "QCOBRO_ACCESS_KEY_ID": "your-access-key-id",
        "QCOBRO_ACCESS_KEY_SECRET": "your-access-key-secret",
        "QCOBRO_WORKSPACE": "your-workspace-access-key-id"
      }
    }
  }
}
```

### Environment variables

| Variable                   | Description                                      | Required |
| -------------------------- | ------------------------------------------------ | :------: |
| `QCOBRO_ACCESS_KEY_ID`     | Workspace API key id                             |   Yes    |
| `QCOBRO_ACCESS_KEY_SECRET` | Workspace API key secret                         |   Yes    |
| `QCOBRO_WORKSPACE`         | Workspace to act in (its `accessKeyId`)          |   Yes    |
| `QCOBRO_ENDPOINT`          | API base URL (default: `https://api.qcobro.com`) |    No    |

These match the same credentials `@qcobro/sdk`'s `loginWithApiKey` and `useWorkspace` take — the
server does nothing but authenticate with them and delegate every tool call to the SDK.

## Tools

1. `portfolios_list` — lists the active workspace's portfolios. Optional input: `includeArchived`.
2. `portfolios_get` — gets a single portfolio by `id`.
3. `portfolios_create` — creates a portfolio (`name`, `clientId`).
4. `portfolios_update` — updates a portfolio; set `archived: true`/`false` to archive/restore.
5. `portfolios_delete` — deletes a portfolio by `id`.
6. `portfolios_list_accounts` — lists a page of a portfolio's accounts (`portfolioId`, optional
   `limit`/`offset`), with the total count.
7. `portfolios_sync_accounts` — synchronizes a batch of account rows into a portfolio
   (`portfolioId`, `mode`: `APPEND_ONLY` | `UPDATE_EXISTING` | `REPLACE`, `rows`).

Every tool's input is validated against the exact same Zod schema the SDK method it delegates to
already validates against — no separate rules to drift out of sync. Invalid input is rejected
before any request reaches the QCobro API.

## Testing with the MCP Inspector

```bash
QCOBRO_ACCESS_KEY_ID="your-access-key-id" \
QCOBRO_ACCESS_KEY_SECRET="your-access-key-secret" \
QCOBRO_WORKSPACE="your-workspace-access-key-id" \
npx @modelcontextprotocol/inspector \
node /path/to/qcobro/mods/mcp/dist/index.js
```

## Troubleshooting

If tool calls fail with an authentication error, verify that:

1. `QCOBRO_ACCESS_KEY_ID`/`QCOBRO_ACCESS_KEY_SECRET` are a valid, unexpired API key pair.
2. `QCOBRO_WORKSPACE` is the accessKeyId of a workspace that key belongs to.
3. The key's role permits the operation you're calling (e.g. a read-only key will reject
   `portfolios_create`).
