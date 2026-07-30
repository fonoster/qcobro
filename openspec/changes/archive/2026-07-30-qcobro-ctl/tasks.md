## 1. SDK: agent templates resource

- [x] 1.1 Add `listAgentTemplatesSchema`/`getAgentTemplateSchema` inline schemas to
      `mods/sdk/src/schemas.ts` (mirroring `listPortfoliosSchema`/`getPortfolioSchema`)
- [x] 1.2 Add `mods/sdk/src/resources/agentTemplates.ts` (`AgentTemplatesResource`:
      `list`, `get`, `create`, `sync`), validating with `@qcobro/common`'s
      `createAgentTemplateSchema`/`syncAgentTemplateSchema` and the new inline schemas
- [x] 1.3 Wire `agentTemplates` into `mods/sdk/src/client.ts`
- [x] 1.4 Export `AgentTemplatesResource` and its schemas/types from `mods/sdk/src/index.ts`
- [x] 1.5 Add `mods/sdk/src/agentTemplates.test.ts` (mirrors `portfolios.test.ts`): valid
      create, invalid create (missing type-required field) rejected client-side, sync

## 2. mods/ctl package scaffold

- [x] 2.1 Create `mods/ctl/package.json` (`@qcobro/ctl`, oclif config: `bin: qcobro`,
      `topicSeparator: ":"`, `plugin-warn-if-update-available`), `tsconfig.json`,
      `bin/run.js`, `bin/dev.js`
- [x] 2.2 Add `src/BaseCommand.ts` (ported from `@fonoster/ctl`, no `insecure` flag)
- [x] 2.3 Add `src/AuthenticatedCommand.ts` (constructs `@qcobro/sdk` `Client`, calls
      `loginWithApiKey` + `useWorkspace` from the active workspace)
- [x] 2.4 Add `src/constants.ts` (`~/.qcobro` base dir, `~/.qcobro/config.json`)

## 3. Workspace config module

- [x] 3.1 Add `src/config/schemas.ts` (local `workspaceConfigSchema`, Zod)
- [x] 3.2 Add `src/config/types.ts`, `getConfig.ts`, `saveConfig.ts`
- [x] 3.3 Add `src/config/addWorkspace.ts` as a validated function
      (`withErrorHandlingAndValidation` + `workspaceConfigSchema`), deactivating other
      workspaces and marking the new one active
- [x] 3.4 Add `src/config/getActiveWorkspace.ts`, `setActiveWorkspace.ts`,
      `removeWorkspace.ts`, `src/config/index.ts` barrel
- [x] 3.5 Unit tests: `addWorkspace` valid input, `addWorkspace` validation-failure case
      (structured error, config file untouched), `setActiveWorkspace`,
      `getActiveWorkspace`, `removeWorkspace`

## 4. Workspace commands

- [x] 4.1 `src/commands/workspaces/login.ts` — prompts (endpoint, accessKeyId,
      accessKeySecret, workspace accessKeyId), validates via a live `portfolios.list()`
      call, saves via `addWorkspace`
- [x] 4.2 `src/commands/workspaces/list.ts`, `active.ts`, `use.ts`, `logout.ts`

## 5. Portfolio commands

- [x] 5.1 `src/commands/portfolios/list.ts` (table output)
- [x] 5.2 `src/commands/portfolios/get.ts <id>`
- [x] 5.3 `src/commands/portfolios/sync.ts` (`--portfolio-id`, `--file`, `--mode`; reads
      and JSON-parses the rows file)

## 6. Agent template commands

- [x] 6.1 `src/commands/agents/create.ts` (type-specific flags per
      `createAgentTemplateSchema`'s discriminated union — implemented all five channel
      types: `VOICE_AI`, `VOICE_PRERECORDED`, `SMS`, `EMAIL`, `WHATSAPP`)
- [x] 6.2 `src/commands/agents/eval.ts <templateId>` — calls `agentTemplates.sync`, then
      re-fetches via `get` to report sync outcome (the real `sync` procedure doesn't echo
      updated config); help text states it validates config/sync, not conversation
      behavior

## 7. mcp:configure command (and mods/mcp cleanup)

- [x] 7.1 Port `mods/mcp/src/config/paths.ts` → `mods/ctl/src/mcpConfigure/paths.ts`
      (unchanged behavior; port its test)
- [x] 7.2 Port `mods/mcp/src/config/writeClaudeConfig.ts` →
      `mods/ctl/src/mcpConfigure/writeClaudeConfig.ts` (unchanged behavior; port its test)
- [x] 7.3 Add `src/commands/mcp/configure.ts` — resolves credentials from the active
      workspace or explicit flag overrides, writes/merges the Claude Desktop config
- [x] 7.4 Remove the `config` subcommand branch, `CONFIG_OPTION_SPEC`, `parseConfigArgs`,
      and `runConfig` from `mods/mcp/src/index.ts`; trim `USAGE` text to `serve` only
- [x] 7.5 Delete `mods/mcp/src/config/paths.ts`, `writeClaudeConfig.ts`, and their
      `.test.ts` files
- [x] 7.6 Update `mods/mcp/src/index.test.ts` to drop the removed `config`-subcommand
      test cases
- [x] 7.7 Update `mods/mcp/README.md`'s "One-command setup" section to
      `npx @qcobro/ctl mcp:configure`

## 8. Package docs and build wiring

- [x] 8.1 Add `mods/ctl/README.md` (oclif `generate:readme` convention: usage, commands
      table, topics — mirroring `@fonoster/ctl`'s README structure)
- [x] 8.2 Add `build`/`clean`/`typecheck`/`test`/`generate:readme` scripts to
      `mods/ctl/package.json`, consistent with `mods/mcp`/`mods/sdk` conventions
- [x] 8.3 Confirm `mods/ctl` is picked up by the root `mods/*` workspace glob and by
      `lerna run build/test/typecheck` — added to root `tsconfig.json` references (needed
      for cross-project typecheck); `npm query .workspace` confirms npm sees all 6
      packages. Root `package.json` itself needed no change (glob-based).

## 9. Docs site

- [x] 9.1 Read `docs-site/CLAUDE.md` policy once more against the drafted page before
      publishing; realistic example IDs (`WO...`, `AP...`), Spanish prose, no internal
      mechanism names
- [x] 9.2 Write the CLI doc page (installation, `workspaces:login`, `mcp:configure`,
      command reference for portfolios/agents topics)
- [x] 9.3 Wire the new page into `docs-site/docs.json` navigation
- [x] 9.4 Update `mcp/overview.mdx` (referenced `npx @qcobro/mcp config`) to point at
      `npx @qcobro/ctl mcp:configure`

## 10. Verification

- [x] 10.1 Build/typecheck/test/lint green — verified per-workspace directly (`npm run
    build/typecheck/test --workspace=mods/X` for common, apiserver, sdk, mcp, ctl,
      webapp) rather than via the root `lerna run` scripts: in this git-worktree
      checkout, lerna's Nx-powered project graph resolves the workspace root via the
      shared `.git` common directory and silently targets the main checkout (which
      lacks `mods/ctl`) instead of this worktree — a local sandboxing artifact, not
      present in real CI (a normal `actions/checkout`). Root `eslint .` (not
      lerna-based) was run directly and is clean.
- [x] 10.2 Smoke-tested the built CLI locally: `--help`, `portfolios:list --help`,
      `mcp:configure --help`, `agents:create --help`, `agents:eval --help`,
      `workspaces:login --help`, and the no-active-workspace error path
      (`portfolios:list` → clear error, exit 1)
- [x] 10.3 `openspec validate qcobro-ctl --strict` passes; `openspec validate --all
    --strict` passes (43/43) after syncing the delta specs into main
