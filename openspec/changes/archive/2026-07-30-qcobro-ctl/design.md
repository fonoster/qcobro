## Context

QCobro already has two dev-facing tooling packages: `@qcobro/sdk` (typed client over the
tRPC API; today wraps only `portfolios`) and `@qcobro/mcp` (an MCP stdio server wrapping the
SDK for AI-agent clients like Claude Desktop). `@qcobro/mcp` grew a `config` subcommand
(`src/index.ts`, `src/config/paths.ts`, `src/config/writeClaudeConfig.ts`) purely to write
Claude Desktop's config file — a general CLI concern bolted onto an MCP server package.

Fonoster's sibling repo (`~/Projects/fonoster/mods/ctl`) already solved "a CLI for our own
SDK" with `@fonoster/ctl`: oclif, `topicSeparator: ":"`, a `BaseCommand`/`AuthenticatedCommand`
pair, a flat JSON workspace-login config at `~/.fonoster/config.json`, and an `mcp:configure`
command. This change ports that shape onto `@qcobro/sdk`, moving the Claude Desktop config
logic out of `@qcobro/mcp` and into the new package.

The apiserver already exposes an `agentTemplates` tRPC router (`list`, `get`, `create`,
`update`, `sync`, `delete` — see `mods/apiserver/src/trpc/routers/agentTemplates.ts`), but
`@qcobro/sdk` doesn't wrap it yet. Issue #41 asks for `agents:create`/`agents:eval` commands;
the SDK needs a thin `AgentTemplatesResource` first, mirroring `PortfoliosResource`.

## Goals / Non-Goals

**Goals:**

- Scaffold `mods/ctl` (`@qcobro/ctl`) as an oclif CLI, installing a `qcobro` bin.
- Port `BaseCommand`/`AuthenticatedCommand` and the workspace-login `config/` module,
  adapted to QCobro's auth model (workspace API key, not Fonoster's `allowInsecure`/gRPC
  shape).
- Implement `portfolios:sync`, `portfolios:list`, `portfolios:get`, `agents:create`,
  `agents:eval`, and `mcp:configure` against `@qcobro/sdk`.
- Extend `@qcobro/sdk` with a thin `AgentTemplatesResource` wrapping the existing
  `agentTemplates` router (no new apiserver surface).
- Move Claude Desktop config writing out of `@qcobro/mcp` into `qcobro mcp:configure`,
  deleting the superseded `config` subcommand and its helpers from `@qcobro/mcp`.
- Document the CLI in `docs-site` per its editorial policy, wired into nav.

**Non-Goals:**

- A full conversational-intelligence evaluation engine (Fonoster's `applications:eval`
  streams live scenario-based conversation tests against Autopilot). QCobro has no such
  capability server-side; building it is out of scope for this issue, which is explicit
  about not inventing new apiserver surface. `agents:eval` in v1 is scoped to what already
  exists: re-running an agent template's Fonoster sync and reporting the result.
- Wrapping every apiserver resource (SIP trunks, numbers, API keys, etc. have no QCobro
  analog). CTL v1 covers exactly the SDK surface named in the issue: portfolios, agents
  (agent templates), and `mcp:configure`.
- Email/password login. CTL v1 authenticates the same way `@qcobro/mcp` and typical
  server-to-server integrations do: a workspace API key (`accessKeyId` +
  `accessKeySecret`) plus the target workspace's `accessKeyId`. This matches the
  credential shape the docs and MCP config already standardize on.
- Publishing to npm / CI wiring beyond what sibling packages (`@qcobro/sdk`, `@qcobro/mcp`)
  already have (`publishConfig`, `access: public`) — release automation is unchanged.

## Decisions

**Oclif shape mirrors `@fonoster/ctl` exactly, adapted names only.** `bin/run.js` (with the
same punycode-warning-suppression + `oclif.execute` boilerplate), `bin/dev.js`,
`topicSeparator: ":"`, `plugin-warn-if-update-available`, `oclif.bin: "qcobro"`,
`oclif.dirname: "qcobro"`. No custom `Help` class (Fonoster's `Help.ts` isn't referenced by
default oclif help needs) — omitting `helpClass` from `oclif` config keeps default oclif
help, avoiding an unnecessary port.

**Auth model: workspace API key, not gRPC insecure-channel flags.** Fonoster's
`BaseCommand.baseFlags` includes `--insecure` (allow non-TLS gRPc). QCobro's SDK talks
tRPC-over-HTTPS with no such concept, so `BaseCommand` in `@qcobro/ctl` carries no
`insecure` flag — `AuthenticatedCommand` constructs `new SDK.Client({ endpoint })`,
`client.loginWithApiKey(...)`, `client.useWorkspace(...)`, mirroring
`mods/mcp/src/utils/createClient.ts`'s existing pattern exactly (same authentication
shape already proven in this repo).

**Workspace config schema and `addWorkspace` use the validated-function pattern.** Per
`CLAUDE.md`, input-validating operations use `withErrorHandlingAndValidation` (from
`@qcobro/common`) wrapping a factory `fn`. `addWorkspace` validates a candidate
`WorkspaceConfig` (endpoint, workspaceAccessKeyId, accessKeyId, accessKeySecret, name)
against a local Zod schema before writing `~/.qcobro/config.json`, throwing a structured
`ValidationError` on malformed input — mirrors the pattern already used server-side
(`createCreateAgentTemplate`) and gives the required validation-failure unit test. The
schema lives locally in `mods/ctl/src/config/schemas.ts`, not `@qcobro/common`: it
describes the CLI's own local config file shape, not a cross-package API contract —
matching the precedent `mods/sdk/src/schemas.ts` already sets for schemas that are
local-only (see that file's own doc comment).

**`agents:create`/`agents:eval` land behind a new SDK `AgentTemplatesResource`.**
Mirrors `PortfoliosResource`'s existing shape: thin methods (`create`, `sync`, `list`,
`get`) that validate with the same `@qcobro/common` schemas the apiserver router already
uses (`createAgentTemplateSchema`, `syncAgentTemplateSchema`), then call
`trpc.agentTemplates.<op>`. `agents:eval` calls `client.agentTemplates.sync({ id })` and
prints the resulting `fonosterAppRef`/sync status — the closest existing operation to
"evaluate this agent template," per the agent-templates spec's own description of `sync`
as a manual re-attempt. This is called out explicitly in the command's help text and the
docs page so it isn't mistaken for Fonoster's live conversational eval.

**`mcp:configure` supersedes `@qcobro/mcp`'s `config` subcommand.** The pure functions
(`claudeDesktopConfigPath`, `buildQCobroEntry`/`mergeClaudeConfig`/`writeClaudeConfig`)
move from `mods/mcp/src/config/` to `mods/ctl/src/mcpConfigure/` unchanged in behavior
(same file shape, same tests, ported verbatim then adapted to read defaults from the
CTL's active workspace when flags are omitted — Fonoster's `mcp:configure` does the same:
resolve workspace from config unless `--workspace`/explicit flags are passed). The command
also accepts explicit `--access-key-id`/`--access-key-secret`/`--workspace`/`--url`
overrides for headless use (CI, docs examples) without requiring `workspaces:login` first,
preserving the exact ergonomics `@qcobro/mcp config` had before removal.
`mods/mcp/src/index.ts` drops the `config` branch entirely (`serve` becomes the only
command; `--help` usage text is trimmed accordingly), and `mods/mcp/README.md`'s "One-command
setup" section is rewritten to `npx @qcobro/ctl mcp:configure`.

**Test runner: `node --import tsx --test`, not mocha/sinon.** Sibling packages `mods/sdk`
and `mods/mcp` already standardize on `node:test` + `tsx` (see their `package.json` `test`
scripts) rather than the generic psstack default of mocha/sinon. `mods/ctl` follows the
established in-repo convention for consistency.

## Risks / Trade-offs

- **[Risk]** `agents:eval` doing sync instead of true conversational evaluation could
  confuse users expecting Fonoster-CLI parity → **Mitigation**: command help text and docs
  explicitly state it validates/re-syncs configuration, not conversation behavior; noted
  as a known v1 scope limit in the proposal and design.
- **[Risk]** Moving `@qcobro/mcp`'s `config` subcommand is a breaking change for anyone
  already scripting `npx @qcobro/mcp config` → **Mitigation**: `@qcobro/mcp`'s CHANGELOG
  and README call out the move; this is pre-1.0-in-spirit internal tooling with no
  external users yet (issue explicitly asks for the consolidation).
- **[Risk]** New workspace-login flow (API key based) diverges from Fonoster's exact
  prompt shape (no `listWorkspaces()` lookup exists in `@qcobro/sdk` yet) → **Mitigation**:
  documented as an intentional adaptation; the user supplies the target workspace's
  `accessKeyId` directly (already the pattern `@qcobro/mcp`'s docs teach), and login
  validates credentials with a live `portfolios.list()` call before saving.

## Migration Plan

1. Add `mods/ctl` package; build/typecheck/test it in isolation first.
2. Extend `@qcobro/sdk` with `AgentTemplatesResource` (additive, no breaking change).
3. Remove `@qcobro/mcp`'s `config` subcommand and its `config/` helpers in the same
   change, once `mcp:configure` is proven equivalent (same merge/write behavior, ported
   tests passing under `mods/ctl`).
4. No data migration; `~/.qcobro/config.json` is a new, CLI-local file with no prior
   version to migrate from.

## Open Questions

None blocking — scope adaptations for `agents:eval` and the login flow are decided above
and documented as intentional, not deferred.
