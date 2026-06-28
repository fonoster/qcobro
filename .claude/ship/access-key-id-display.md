# Ship checkpoint — access-key-id-display

Started: 2026-06-28
Current stage: DONE — synced + archived 2026-06-28

**Scope:** Surface the workspace's `accessKeyId` (referenced by the SDK/API docs for the
`x-workspace` header and `useWorkspace()`) in the console so operators can find and copy it.
Two web-console surfaces: each card on `/workspaces` shows its `accessKeyId` (copyable), and
the Panel de control (Home) shows the active workspace's `accessKeyId` (copyable). Frontend
only — `accessKeyId` already rides on `workspaces.summaries`/`workspaces.list`.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo-root `pencil.pen`) · Storybook: yes (@qcobro/webapp) · E2E: yes (Playwright)

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                    |
| :-- | :-------------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | OpenSpec change `access-key-id-display` created + valid (4/4). web-console delta (ADDED requirement). No backend work.                                                                                                                   |
| 1   | Design (Pencil) | done   | Card IdPill (zB5yE BottomRow, all 6 instances) + dashboard header ID chip (YBOD5 t6xMRN/HeaderRight). User approved 2026-06-28. NOTE: pencil.pen edits live in app, not yet saved to disk.                                               |
| 2   | Spec reconcile  | done   | No design drift — spec already covers "displayed + copyable on cards + dashboard". Validated (4/4).                                                                                                                                      |
| 3   | Build           | done   | CopyField (field+inline variants, useClipboard) + story; ShowSecretDialog refactored to use it; i18n (apiKeys.copy→common.copy, +card/home aria + home.workspaceId); Workspaces card bottom row; Home header chip. typecheck+lint clean. |
| 4   | Test            | done   | Unit 18/18. New e2e workspace-access-key (visible+copyable both surfaces, card copy no-nav) green. Regression: api-keys + auth-workspaces green. Live screenshots match Pencil design. No validated fn → no unit file.                   |
| 5   | Sync            | done   | Appended "Workspace accessKeyId is visible and copyable" requirement to openspec/specs/web-console/spec.md. validate ok.                                                                                                                 |
| 6   | Archive         | done   | Moved to openspec/changes/archive/2026-06-28-access-key-id-display. openspec validate --all = 29 passed, 0 failed.                                                                                                                       |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-28 — Stage 0 done. Created OpenSpec change (proposal/design/specs/tasks, valid).
  Decisions: extract `CopyRow` from `ShowSecretDialog` → shared `CopyField` (+ compact
  variant); card copy must `stopPropagation` (not select workspace); dashboard ID goes in the
  header block, not a 6th KPI. No apiserver/common/schema changes.
- 2026-06-28 — Checkpoint created; framing the change.
