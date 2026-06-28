# Ship checkpoint — account-menu

Started: 2026-06-28
Current stage: DONE

**Scope:** Make account-level actions reachable from the workspaces hub. After auth, users
land on `/workspaces` (renamed from `/create-workspace`); the hub avatar gains a dropdown
(account header, Profile link, language switcher, Log out) that fixes issue #9 (no logout /
trapped user). `/profile` is promoted to an account-level route reachable without a workspace.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (playwright.config.ts)

| #   | Stage           | Status | Notes                                                                                                                                   |
| :-- | :-------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Surfaces detected; scope stated                                                                                                         |
| 1   | Design (Pencil) | done   | Comp/Account Menu (Jis25) + hub state BfwGR; approved by user                                                                           |
| 2   | Spec reconcile  | done   | Design matched delta spec; no behavior drift; `openspec validate account-menu` passes                                                   |
| 3   | Build           | done   | menu.tsx primitives; AccountMenu (lang persisted); AccountLayout; routes moved; UserMenu refactored; Workspaces/Profile chrome adjusted |
| 4   | Test            | done   | lint+typecheck green; full e2e 16/16 incl. 2 new (hub logout, profile w/o workspace); no validated fns → no unit test                   |
| 5   | Sync            | done   | Delta promoted into openspec/specs/web-console; both validate                                                                           |
| 6   | Archive         | done   | Moved to openspec/changes/archive/2026-06-28-account-menu                                                                               |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-28 — Build+Test done. New: menu.tsx, AccountMenu.tsx, AccountLayout.tsx, menu.stories.tsx, e2e/account-menu.spec.ts. Refactored UserMenu to shared primitives; moved /profile + /workspaces under AccountLayout; AccountMenu language persists to profile. lint/typecheck green; e2e 16/16.
- 2026-06-28 — Design approved (Pencil Comp/Account Menu Jis25). Spec reconcile: no drift.
- 2026-06-28 — Proposal created & validated (proposal/design/specs/tasks); web-console delta covers landing, rename, hub account menu, profile reachability.
- 2026-06-28 — Decisions: always show workspaces list after login (no single-workspace auto-forward); route name `/workspaces`; menu = account header + Profile + language switcher + Log out; promote `/profile` to account-level route.
- 2026-06-28 — Routing + rename already implemented in webapp (uncommitted) ahead of formalizing via ship; tasks 1.x and 4.1 marked done.
- 2026-06-28 — Checkpoint created; framing the change.
