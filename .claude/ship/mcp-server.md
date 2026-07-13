# Ship checkpoint — mcp-server

Started: 2026-07-12
Current stage: DONE — archived 2026-07-13

**Scope:** New `@qcobro/mcp` package (`mods/mcp`) — a stdio MCP server wrapping `@qcobro/sdk`'s
`Client`, authenticating via workspace API key exactly like the SDK, exposing the `portfolios`
resource (list/get/create/update/delete/listAccounts/syncAccounts) as MCP tools. Includes a
bundled `config` subcommand (`npx @qcobro/mcp config --url --apiKey --apiSecret`) that writes
Claude Desktop's `claude_desktop_config.json`. Originates from GitHub issue fonoster/qcobro#16.

**Detected surfaces:** OpenSpec: yes · Pencil: not relevant (no UI/webapp changes — this ships a
CLI/server package) · Storybook: not relevant (no components) · E2E: Playwright exists in-repo but
is webapp-UI-only; this change follows the `sdk` change's precedent (see
`openspec/changes/archive/2026-06-23-sdk`, `.claude/ship/sdk.md`) of an in-process stub-server
integration test instead.

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :-- | :-------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change `mcp-server` created + validated (proposal/design/tasks/specs). Capability: `mcp-server`. Branch `feat/mcp-server` off `main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1   | Design (Pencil) | skipped | No Pencil/UI surface (user directive: this ships no webapp changes). Docs (README + Mintlify page) are produced as Build/Docs tasks (tasks.md §6), not a Pencil iteration loop.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2   | Spec reconcile  | done    | Specs (`specs/mcp-server/spec.md`) authored directly from the user's locked-in decisions during Frame; no design iteration occurred to cause drift. `openspec validate mcp-server` passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | Build           | done    | `mods/mcp` (`@qcobro/mcp`): env config, `createClient`, `McpServer` + stdio transport, 7 portfolio tools (list/get/create/update/delete/listAccounts/syncAccounts) reusing SDK+common schemas, `config` CLI subcommand (`node:util` parseArgs, matching `engine-eval`'s pattern). SDK gained 3 new schema exports. Docs: `mods/mcp/README.md` + `docs-site/mcp/overview.mdx` (new "MCP" nav group, cross-linked from `/sdk/overview`), reviewed against `docs-site/CLAUDE.md`'s editorial policy (fixed an "Identity" mention and a "Zod" mention that violated the no-internals rule; fixed example IDs to the realistic `WO...` format). |
| 4   | Test            | done    | 30/30 new tests in `mods/mcp` (env, paths, writeClaudeConfig, CLI dispatch, and a real integration test: stub tRPC server + real SDK `Client` + real `McpServer` driven over an MCP `InMemoryTransport`). SDK's own 19/19 still green after its export widening. Repo-wide `lint`/`typecheck`/`build`/`test` all green across 5 workspaces.                                                                                                                                                                                                                                                                                                |
| 5   | Sync            | done    | User approved. Created new `openspec/specs/mcp-server/spec.md` (all 3 requirements ADDED, no existing capability to merge into). `openspec validate --all` = 41 passed, 0 failed.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | Archive         | done    | User approved. Moved to `openspec/changes/archive/2026-07-13-mcp-server/`. `openspec validate --all` = 40 passed, 0 failed. 30/30 tasks checked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-12 — Stage 0 done: created OpenSpec change `mcp-server` via `/opsx:propose` (proposal,
  design, specs/mcp-server/spec.md, tasks — all validated). Locked-in decisions from the user:
  auth mirrors `@qcobro/sdk`'s `loginWithApiKey` (no new auth mechanism), no new MCP permission
  role (Identity role on the API key is authoritative), v1 tool surface = exactly the SDK's
  `portfolios` resource, reference implementation is Fonoster's own `mods/mcp` (local checkout at
  /Users/psanders/Projects/fonoster/mods/mcp) but QCobro-named env vars (`QCOBRO_MCP_*`), and the
  `config` helper lives inside `@qcobro/mcp` itself (no separate `ctl` package exists in QCobro).
- 2026-07-12 — Branch `feat/mcp-server` created off `main` (pulled to latest, includes the
  portfolio-last-synced merge).
- 2026-07-12 — Entering Stage 1: no Pencil design loop (no UI surface); design deliverable is
  docs, produced during Build/Docs (tasks.md §6) rather than a separate stage-1 iteration.
- 2026-07-13 — Corrected the env-var/flag naming from the initial `QCOBRO_MCP_*` proposal (design.md
  D3): found `@qcobro/common`'s existing `engine-eval` CLI already establishes this repo's own
  convention for a QCobro CLI authenticating with a workspace API key
  (`QCOBRO_ACCESS_KEY_ID`/`QCOBRO_ACCESS_KEY_SECRET`, `--access-key-id`/`--access-key-secret` kebab
  flags, `DEFAULT_URL = https://api.qcobro.com`, testable `main(argv, env, ...)` + `parseArgs`
  structure). Followed it instead of the Fonoster reference's naming, per CLAUDE.md's directive to
  follow repo conventions; added `QCOBRO_WORKSPACE`/`--workspace` as the one addition this tool
  needs beyond `engine-eval`. Updated design.md/tasks.md/spec.md accordingly before implementing.
- 2026-07-13 — Build + Test stages complete, all green (see table). Mid-session the user asked to
  confirm the package would be publicly `npx`-able — `package.json` already had
  `"publishConfig": {"access": "public"}` matching `@qcobro/sdk`/`@qcobro/common`'s already-published
  convention, so no change was needed.
- 2026-07-13 — Docs written via `/ps:docs`: discovered mid-draft that `docs-site/CLAUDE.md` (an
  editorial policy file, not previously in context) forbids naming internal services (e.g.
  "Identity") and mandates Spanish prose + realistic `WO...`-format example IDs. Caught and fixed
  an "Identity" mention and a "Zod" mention in the draft before finalizing — worth remembering for
  any future docs-site work.
