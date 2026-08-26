# Ship checkpoint — workspace-switch-refresh

Started: 2026-08-26
Current stage: DONE — archived 2026-08-26, PR pending

**Scope:** Switching the active workspace (sidebar switcher, or the workspaces hub) doesn't
refresh the screen the user is currently on. Root cause: the active workspace is threaded into
every tRPC call as a request header, never as part of a React Query key, so `setWorkspace` updated
context/localStorage but never invalidated the cache. Fix: `setWorkspace` resets the query cache.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (skipped — no design dimension) · Storybook: yes · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                                                         |
| :-- | :-------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Root cause diagnosed by a dispatched subagent (fresh, no prior context), which read `WorkspaceSwitcher.tsx`, `auth.tsx`, and `trpc.ts` and traced the missing cache invalidation precisely.   |
| 1   | Design (Pencil) | skipped | Pure state-management bug — no visual/copy dimension.                                                                                                                                         |
| 2   | Spec reconcile  | done    | `openspec validate` = valid.                                                                                                                                                                  |
| 3   | Build           | done    | `setWorkspace` (`mods/webapp/src/lib/auth.tsx`) now resets the query cache after updating the active workspace. typecheck + lint clean.                                                       |
| 4   | Test            | done    | New e2e spec `e2e/workspace-switch-refresh.spec.ts`, verified both ways: fails on pre-fix code (confirmed via a temporary stash of the fix), passes with the fix restored.                    |
| 5   | Sync            | done    | Promoted delta → `openspec/specs/web-console/spec.md` ("Switching workspaces refreshes the current screen"). `openspec validate --all` clean (one pre-existing, unrelated failure elsewhere). |
| 6   | Archive         | done    | Moved to `openspec/changes/archive/2026-08-26-workspace-switch-refresh`.                                                                                                                      |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-26 — A dispatched subagent fully root-caused this and drafted the fix + test, but could
  not create its own worktree or commit (subagent working directories inherit the parent session's
  worktree pin — confirmed exhaustively: cd, git -C, GIT_DIR/GIT_WORK_TREE, and Edit/Write on files
  outside the pinned worktree were all refused). Applied its diff and test manually in a proper
  worktree instead, verified the diagnosis line-by-line against the real source first (it was
  exactly right), then validated the test both ways (fails pre-fix, passes post-fix) before
  proceeding.
- 2026-08-26 — `playwright.config.ts` hard-codes baseURL to :5173, which another concurrent
  session's dev server already occupied. Ran this worktree's webapp on :5176 instead and patched
  the config locally just for the test run (reverted before committing) rather than disturbing the
  other session's server.
