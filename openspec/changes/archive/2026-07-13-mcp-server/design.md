## Context

`@qcobro/sdk` (shipped separately, see `openspec/changes/archive/2026-06-23-sdk`) already packages
auth (credentials or workspace API key), workspace selection, and a `portfolios` resource namespace
behind a typed `Client`. Fonoster's own product ships an analogous MCP server
(`@fonoster/mcp`, a sibling package to `@fonoster/sdk`) that wraps its SDK's client, registers one
MCP tool per SDK method via `@modelcontextprotocol/sdk`'s `McpServer` + `StdioServerTransport`, reads
credentials from environment variables, and ships a companion `ctl mcp:configure` command that writes
Claude Desktop's config file for the user. That shape is proven and directly reusable: this change
builds the QCobro equivalent, wrapping `@qcobro/sdk` instead of `@fonoster/sdk`.

QCobro has no separate CLI package (`ctl`) the way Fonoster does, so the config-writing helper can't
live alongside a pre-authenticated CLI session. Instead it lives inside `@qcobro/mcp` itself as a
`config` subcommand that takes the endpoint and API key explicitly as flags — the user already has
these from creating an API key in the console (see the `api-keys` capability).

## Goals / Non-Goals

**Goals:**

- A new `@qcobro/mcp` package (`mods/mcp`) that an MCP-capable client (Claude Desktop, other MCP
  hosts) can launch via `npx @qcobro/mcp` and use to call QCobro's portfolios API.
- One MCP tool per `client.portfolios` method: `list`, `get`, `create`, `update`, `delete`,
  `listAccounts`, `syncAccounts` — thin wrappers that delegate to the SDK, which already validates
  input and handles auth/refresh.
- Env-var configuration for the server process: endpoint, workspace API key
  (accessKeyId/accessKeySecret), and active workspace.
- A `config` subcommand (`@qcobro/mcp config --url --apiKey --apiSecret [--workspace]`) that writes
  or merges a `mcpServers.qcobro` entry into Claude Desktop's `claude_desktop_config.json`, so a user
  goes from "I have an API key" to "Claude can call QCobro" in one command.

**Non-Goals:**

- Any new Fonoster Identity role or permission-scoping mechanism for MCP access. The workspace API
  key used already carries whatever role Identity assigns it (see `api-keys`); this change does not
  introduce a distinct "MCP role."
- Tools for routers the SDK doesn't wrap yet (campaigns, outreach, apiKeys, billing, gestiones).
  Widening the tool surface is a follow-up once the SDK itself grows those resources.
- Config helpers for MCP clients other than Claude Desktop (e.g. Cursor, Windsurf). The `config`
  subcommand's `--client` surface can grow later; v1 only supports `claude`.
- Prompts (guided multi-step flows), which Fonoster's MCP also offers — deferred; v1 ships tools only.
- Rate limiting or MCP-specific audit logging. Requests flow through the same apiserver as the SDK
  and webapp, which is the right layer for that if/when it's added.

## Decisions

### D1. The MCP server wraps `@qcobro/sdk`'s `Client`, not raw tRPC

`mods/mcp` depends on `@qcobro/sdk` and constructs a single `Client` at startup (`createClient()`),
authenticating via `client.loginWithApiKey({ accessKeyId, accessKeySecret })` and selecting the
workspace via `client.useWorkspace(...)`. Each tool handler calls the matching `client.portfolios.*`
method and formats the result as MCP `content`.

- _Why:_ the SDK already owns input validation (shared `@qcobro/common`/`mods/sdk/src/schemas.ts`
  schemas), auth-token refresh, and header injection — reusing it means the MCP layer has zero
  business logic of its own, matching how `@fonoster/mcp` wraps `@fonoster/sdk`.
- _Alternative considered:_ have the MCP server talk tRPC directly (like the SDK does) — rejected:
  would duplicate auth/validation/refresh logic that already exists and is tested in the SDK.

### D2. One tool per SDK method, zod schemas from the SDK reused as MCP input schemas

Each `server.tool(name, description, schema.shape, handler)` call passes the _same_ Zod schema
object the SDK method already validates against (e.g. `createPortfolioSchema.shape`,
`listAccountsSchema.shape`), imported from `@qcobro/common` or `mods/sdk`'s exported schemas. Tool
names follow `portfolios_<verb>` (`portfolios_list`, `portfolios_get`, `portfolios_create`,
`portfolios_update`, `portfolios_delete`, `portfolios_list_accounts`, `portfolios_sync_accounts`) to
read unambiguously in an agent's tool palette.

- _Why:_ single source of truth for the contract — no second copy of validation rules to drift.
  MCP's `server.tool()` API accepts a Zod raw shape directly, so this is a direct pass-through, not a
  translation layer.
- _Trade-off:_ requires `mods/sdk`'s currently-internal schemas (`listPortfoliosSchema`,
  `getPortfolioSchema`, `listAccountsSchema`) to be exported from the SDK's public surface (they are
  presently only imported internally by `resources/portfolios.ts`). Exporting them is additive and
  matches `@qcobro/common`'s existing schemas already being public.

### D3. Env-var configuration, matching the repo's own `engine-eval` CLI convention

`@qcobro/common`'s existing `engine-eval` CLI (`mods/common/src/bin/engineEval.ts`) already
establishes the repo's convention for a QCobro CLI's API-key configuration: env vars
`QCOBRO_ACCESS_KEY_ID` / `QCOBRO_ACCESS_KEY_SECRET` as fallbacks for `--access-key-id`/
`--access-key-secret` flags, and `DEFAULT_URL = "https://api.qcobro.com"` as the `--url` default.
`mods/mcp/src/env.ts` follows the same names for the server process: `QCOBRO_ENDPOINT` (optional,
defaults to `https://api.qcobro.com`), `QCOBRO_ACCESS_KEY_ID` (required), `QCOBRO_ACCESS_KEY_SECRET`
(required), and `QCOBRO_WORKSPACE` (required — the workspace's `accessKeyId`, passed to
`useWorkspace`; confirmed distinct from the API key's own `accessKeyId` per `sdk-client`'s workspace
selection requirement and `mods/sdk/src/client.test.ts`'s fixtures, e.g. API key `ak_ws_one` selecting
workspace `ws_one`).

- _Why match `engine-eval` over Fonoster's `MCP_WORKSPACE_ACCESS_KEY_ID`/`MCP_APIKEY_ACCESS_KEY_ID`/
  `MCP_APIKEY_ACCESS_KEY_SECRET`:_ the Fonoster names were the starting reference, but this repo
  already has its own established convention for exactly this kind of tool (a QCobro CLI
  authenticating with a workspace API key), and CLAUDE.md directs following repo conventions over an
  external reference. Reusing `QCOBRO_ACCESS_KEY_ID`/`QCOBRO_ACCESS_KEY_SECRET` verbatim also means a
  user who already has these set (e.g. for `engine-eval`) gets a sensible default for the MCP server
  too, with `QCOBRO_WORKSPACE` as the one addition this tool needs that `engine-eval` doesn't.
- _Alternative considered:_ an `MCP`-namespaced prefix to avoid collisions with other vendors' MCP
  servers — rejected as unnecessary: each `mcpServers.<name>` entry in `claude_desktop_config.json`
  gets its own isolated `env` map passed only to that spawned process, so there is no shared
  namespace to collide in.

### D4. `config` subcommand lives in `@qcobro/mcp`'s own bin, not a separate CLI

`@qcobro/mcp`'s `bin` entry dispatches on `process.argv[2]`: no subcommand (or `serve`) starts the
MCP stdio server (today's default behavior); `config` runs the Claude Desktop config writer instead
of starting the server. Both subcommands parse flags with `node:util`'s `parseArgs`, matching
`engine-eval`'s pattern (a testable `parseCliArgs`/`main(argv, env, ...)` split, a `CliError` class,
a `USAGE` string, kebab-case flags: `--access-key-id`, `--access-key-secret`, `--url`, `--workspace`).
The `config` writer:

1. Resolves `claude_desktop_config.json`'s path per OS (macOS: `~/Library/Application
Support/Claude/claude_desktop_config.json`; Windows: `%APPDATA%/Claude/claude_desktop_config.json`).
2. Reads the existing file if present (tolerating a missing/empty file), merges in an
   `mcpServers.qcobro` entry (`command: "npx"`, `args: ["-y", "@qcobro/mcp@latest"]`, `env:` the four
   vars from D3), and writes it back — preserving any other `mcpServers` entries already there (e.g.
   a user who also has `@fonoster/mcp` configured).
3. Prints a confirmation, without ever printing the secret back after the first run (it's read from
   the `--access-key-secret` flag the user just typed, so nothing new is exposed).

- _Why in-package rather than a new `@qcobro/ctl`:_ QCobro doesn't have (and this change doesn't
  introduce) a general-purpose CLI the way Fonoster's `ctl` is. A single self-contained
  `npx @qcobro/mcp config ...` command is the smallest thing that gives users the same one-command
  setup Fonoster's `ctl mcp:configure` provides, without standing up new infrastructure.
- _Why explicit flags instead of reading a logged-in session:_ Fonoster's `configure` command reads
  credentials from `ctl`'s own persisted login state. QCobro has no equivalent local session to read
  from a bare npx invocation, so the user supplies `--url`/`--access-key-id`/`--access-key-secret`/
  `--workspace` directly (copied from the console's API Keys page — see `api-keys`). `--url` defaults
  to `https://api.qcobro.com` so most users only need to pass the credential and workspace flags.
- _Alternative considered:_ prompt interactively for missing flags — deferred; flags-only is
  scriptable and sufficient for v1, and an interactive prompt can be layered on non-breakingly later.

## Risks / Trade-offs

- **Exporting `mods/sdk`'s internal schemas widens its public surface.** → Limited to the four
  schemas actually needed for tool input (`listPortfoliosSchema`, `getPortfolioSchema`,
  `listAccountsSchema`, plus already-public `@qcobro/common` schemas); documented in the SDK's
  `index.ts` exports alongside existing ones.
- **`config` subcommand can clobber a hand-edited `claude_desktop_config.json` if it's malformed
  JSON.** → Mirror Fonoster's behavior: if the existing file fails to parse, warn and start from an
  empty `{ mcpServers: {} }` rather than crashing, so the command still succeeds; the user's other
  entries are lost only in that already-broken-file edge case, which is called out in the README.
- **A single admin-scoped API key drives every tool, including the mutating ones
  (create/update/delete/syncAccounts).** There is no MCP-specific write gate. → Explicitly documented
  as a Non-Goal or this change (permission scoping is Identity's concern per the issue's own framing)
  and called out in the README so operators mint a key they're comfortable handing to an agent.
- **stdio transport means the server only works with local/desktop MCP hosts, not a hosted
  integration.** → Acceptable for v1 scope (Claude Desktop); a remote/HTTP transport is a clearly
  separable follow-up if demand shows up.

## Migration Plan

Additive: a brand-new package and a new SDK export surface (schemas only, no behavior change to
existing SDK methods). No existing code changes behavior. Rollout is publishing `@qcobro/mcp` to npm;
rollback is not publishing / unpublishing it. `mods/sdk`, `mods/apiserver`, and `mods/webapp` are
otherwise untouched.
