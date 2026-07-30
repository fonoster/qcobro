## Why

QCobro's tooling surface (`mods/sdk`, `mods/mcp`) has grown, but there's no fast, scriptable
way for developers to perform common operations — syncing a portfolio, creating an agent
template, inspecting resources — without going through the webapp UI. Dev tooling is also
scattered: `@qcobro/mcp` ships its own one-off `config` subcommand (and the `src/config/`
helpers behind it) purely to write Claude Desktop's config file, duplicating what should be
a general-purpose CLI concern. Fonoster solved both problems with `@fonoster/ctl`, an
oclif-based CLI on top of `@fonoster/sdk` with workspace/login config, resource-scoped
command topics, a shared `BaseCommand`/`AuthenticatedCommand` pattern, and an `mcp:configure`
command. QCobro should follow the same pattern, adapted to its stack (Closes #41).

## What Changes

- Add a new `mods/ctl` workspace package (`@qcobro/ctl`), oclif-based, mirroring
  `fonoster/mods/ctl`'s shape: `bin/run.js`, `topicSeparator: ":"`,
  `@oclif/plugin-warn-if-update-available`, `BaseCommand`/`AuthenticatedCommand`.
- Built on `@qcobro/sdk` (not raw tRPC) for all resource access, consistent with
  `@qcobro/common` being the single source of truth for contracts.
- Add a `config/` module for workspace login and active-workspace selection
  (`addWorkspace`, `getActiveWorkspace`, `setActiveWorkspace`, `saveConfig`), stored at
  `~/.qcobro/config.json`, adapted to QCobro's auth model (workspace API key: `accessKeyId`
  - `accessKeySecret`, acting in a target workspace's `accessKeyId`).
- `addWorkspace` is a validated function (Zod schema + `withErrorHandlingAndValidation`
  from `@qcobro/common`), rejecting a malformed workspace config before it's persisted.
- Command topics:
  - `qcobro workspaces:login` / `logout` / `list` / `use` / `active`
  - `qcobro portfolios:sync` / `list` / `get`
  - `qcobro agents:create` / `eval`
  - `qcobro mcp:configure`
- Extend `@qcobro/sdk` with a thin `AgentTemplatesResource` (`create`, `sync`, `list`,
  `get`), mirroring `PortfoliosResource`'s pattern — wraps the apiserver's existing
  `agentTemplates` tRPC router (`create`, `sync` procedures already exist server-side; no
  new apiserver surface is introduced).
- `agents:eval` maps onto the existing `agentTemplates.sync` operation (documented in
  `agent-templates` spec as "manually re-attempt the Fonoster sync") — QCobro has no
  conversational-intelligence evaluation feature today, so v1 "eval" validates a template's
  configuration by re-running its Fonoster sync and reporting the resulting sync status.
  Full scenario-based evaluation (Fonoster's `applications:eval`) is out of scope; this is
  a scoped adaptation, not new apiserver behavior.
- `mcp:configure` ports `@qcobro/mcp`'s existing `config` subcommand logic (Claude Desktop
  config path resolution + merge/write) into `qcobro mcp:configure`, sourcing credentials
  from the CTL's active workspace by default (with flag overrides), and defaulting to the
  `claude` client like Fonoster's version.
- **Cleanup**: remove `@qcobro/mcp`'s `config` subcommand and its `src/config/` helpers
  (`paths.ts`, `writeClaudeConfig.ts`) and their tests — this is the "one-off script"
  the issue calls out to fold into CTL. `@qcobro/mcp`'s README is updated to point at
  `npx @qcobro/ctl mcp:configure`.
- Add a public docs-site page (`docs-site/cli/overview.mdx` or similar) documenting the
  CLI per `docs-site/CLAUDE.md`'s editorial policy (Spanish prose, realistic IDs, no
  internal mechanism names), wired into `docs-site/docs.json` nav.
- Package README for `@qcobro/ctl` generated via oclif's `generate:readme` convention,
  consistent with `@fonoster/ctl`'s README.

## Capabilities

### New Capabilities

- `ctl`: the `@qcobro/ctl` command-line tool — command topics, workspace/login config,
  `BaseCommand`/`AuthenticatedCommand`, and the `mcp:configure` command.
- `sdk-agent-templates`: the `client.agentTemplates` resource of `@qcobro/sdk` — thin,
  validated `create`/`sync`/`list`/`get` methods wrapping the apiserver's existing
  `agentTemplates` router, mirroring `sdk-portfolios`'s pattern.

### Modified Capabilities

- `mcp-server`: the `@qcobro/mcp` package's `config` subcommand is removed; MCP-client
  configuration becomes a `@qcobro/ctl` capability. `@qcobro/mcp`'s server behavior
  (`serve`, tool set) is unchanged.

## Impact

- **New package**: `mods/ctl` (`@qcobro/ctl`), workspace-linked via `mods/*` glob.
- **`mods/sdk`**: adds `AgentTemplatesResource` and its inline list/get schemas; new
  `src/agentTemplates.test.ts`.
- **`mods/mcp`**: removes `src/config/paths.ts`, `src/config/writeClaudeConfig.ts`, their
  tests, and the `config` subcommand branch in `src/index.ts`; README updated.
- **`docs-site`**: new CLI doc page + nav entry in `docs-site/docs.json`.
- **No apiserver changes** — CTL and the SDK extension only wrap existing tRPC procedures.
