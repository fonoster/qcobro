# Ship checkpoint — qcobro-ctl

Started: 2026-07-30
Current stage: 6 — Archive (done)

**Scope:** Add `@qcobro/ctl`, an oclif CLI mirroring `@fonoster/ctl`'s shape, built on
`@qcobro/sdk`. Ships `workspaces:*` login/config commands, `portfolios:sync/list/get`,
`agents:create/eval` (agents:eval maps to the existing `agentTemplates.sync` re-sync
operation — no conversational-eval feature exists in QCobro), and `mcp:configure`
(supersedes `@qcobro/mcp`'s removed `config` subcommand). Extends `@qcobro/sdk` with a
thin `AgentTemplatesResource`. Adds a public docs-site page. Issue #41.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo has pencil.pen, but this change
has no UI surface) · Storybook: yes (webapp) but not applicable to this change · E2E:
yes (Playwright) but not applicable — this is a CLI package with no browser flow.

**Autonomous run**: pre-authorized by the task brief to proceed through all stages,
including the normally human-gated Sync and Archive stages, without pausing for
confirmation. Noted here per the skill's own instruction to record this decision.

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                    |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Scope above; read Fonoster ctl reference, mods/sdk, mods/mcp, docs-site/CLAUDE.md, apiserver agentTemplates router                                                                                                                                                                       |
| 1   | Design (Pencil) | skipped | CLI tool, no webapp/Pencil UI surface — issue and task brief both call this out explicitly                                                                                                                                                                                               |
| 2   | Spec reconcile  | done    | No design stage ran, so no drift; delta specs (`ctl`, `sdk-agent-templates`, `mcp-server` REMOVED) already match the proposal as authored. `openspec validate qcobro-ctl --strict` passed                                                                                                |
| 3   | Build           | done    | `mods/ctl` scaffolded (oclif, BaseCommand/AuthenticatedCommand, config module, 11 commands, mcpConfigure/); `mods/sdk` extended with `AgentTemplatesResource`; `mods/mcp`'s `config` subcommand + `src/config/` removed; docs-site page + nav added; README generated via `oclif readme` |
| 4   | Test            | done    | Unit tests incl. validation-failure cases (sdk + ctl); build/typecheck/test green per-package (common, apiserver, sdk, mcp, ctl, webapp); root `eslint .` clean; CLI smoke-tested via `bin/run.js` (help, error paths). See note below on the lerna/Nx worktree quirk                    |
| 5   | Sync            | done    | Promoted `ctl` and `sdk-agent-templates` as new main specs; applied the `mcp-server` REMOVED requirement. `openspec validate --all --strict` → 43/43 passed                                                                                                                              |
| 6   | Archive         | done    | Moved to `openspec/changes/archive/2026-07-30-qcobro-ctl`                                                                                                                                                                                                                                |

**Environment note**: in this worktree, `lerna run build/typecheck` (Nx-powered) resolves the
workspace root via the git _common_ directory and silently operates on the main checkout
(`/Users/psanders/Projects/qcobro`, 5 packages) instead of this worktree (6 packages,
including the new `mods/ctl`) — a local sandboxing artifact, not present in real CI (a normal
`actions/checkout`). Verified every workspace individually via plain `npm run
build/typecheck/test --workspace=mods/X` instead (cwd-based, unaffected by the quirk). Root
`eslint .` is unaffected (not lerna-based) and was run directly — clean. A stray diagnostic
`npx tsc -b tsconfig.json --force` run (used to double check cross-project types) generated
678 stray build artifacts across `e2e/`, `mods/apiserver/scripts/`, etc. (root tsconfig has no
`include`, so bare `tsc -b` also compiles the whole tree, not just the referenced projects) —
all removed before committing; `git status` confirmed clean.

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-30 — OpenSpec change `qcobro-ctl` proposed and validated (proposal/design/specs/tasks).
- 2026-07-30 — Design stage skipped: no UI surface for a CLI tool.
- 2026-07-30 — Spec reconcile: nothing changed since proposal (no design stage), confirmed via `openspec validate --strict`.
- 2026-07-30 — Starting build: mods/sdk AgentTemplatesResource first (dependency for CTL's agents:\* commands), then mods/ctl scaffold, then mods/mcp cleanup.
- 2026-07-30 — Build complete: mods/ctl scaffolded and wired into root tsconfig references; mods/mcp's config subcommand removed and README/docs-site updated to point at `qcobro mcp:configure`.
- 2026-07-30 — Test stage complete: per-package build/typecheck/test green (bypassing lerna due to the worktree/Nx quirk noted above); root lint clean; CLI smoke-tested manually.
- 2026-07-30 — Proceeding to Sync and Archive per pre-authorization; then commit, PR, and watch checks.
- 2026-07-30 — Sync complete: `openspec/specs/ctl/spec.md` and `openspec/specs/sdk-agent-templates/spec.md` created; `openspec/specs/mcp-server/spec.md`'s "Self-service Claude Desktop configuration" requirement removed. Full validate: 43/43.
- 2026-07-30 — Archive complete: change moved to `openspec/changes/archive/2026-07-30-qcobro-ctl`. Ship loop done; proceeding to commit + PR.
