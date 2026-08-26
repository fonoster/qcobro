# Ship checkpoint — members-owner-name

Started: 2026-08-25
Current stage: 0 — Frame (done, entering Design)

**Scope:** Fix the Members screen showing the workspace owner's email instead of their name.
Root cause: the owner row is built client-side from the decoded ID token, which never carries a
`name` claim; regular members correctly read `name` from `workspaces.listMembers`. Fix: source the
owner row's name from the existing `profile.get` endpoint instead.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                       |
| :-- | :-------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | New OpenSpec change `members-owner-name` created. `openspec validate` = valid. Root cause already fully diagnosed in an earlier session (see decision log). |
| 1   | Design (Pencil) | pending |                                                                                                                                                             |
| 2   | Spec reconcile  | pending |                                                                                                                                                             |
| 3   | Build           | pending |                                                                                                                                                             |
| 4   | Test            | pending |                                                                                                                                                             |
| 5   | Sync            | pending |                                                                                                                                                             |
| 6   | Archive         | pending |                                                                                                                                                             |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-25 — Frame done. Root cause (diagnosed earlier this session via an investigation
  subagent): `Members.tsx:84-94` builds the owner row from `currentUser.name`
  (`mods/webapp/src/lib/auth.tsx`'s `decodeUser`, decoding the ID token JWT). Identity's ID-token
  payload builder (`createGetIdTokenPayload.js`) never includes a `name` claim — only `ref`,
  `email`, `phoneNumber`, verification flags — so `currentUser.name` always falls back to email.
  Regular members read `name` from `workspaces.listMembers`, which pulls it straight from
  Identity's `User` DB row (`listWorkspaceMembers.js:59`) — that's why only the owner is affected.
  The owner's real name already exists in that same DB row and is already exposed by
  `profile.get` (`mods/apiserver/src/trpc/routers/profile.ts`, calls `ctx.identity.getUser`), which
  Members.tsx isn't using. Fix: source the owner row's name from `trpc.profile.get`. No apiserver
  or Identity changes needed. Added a new "List workspace members" requirement to the `workspaces`
  capability spec — this behavior (owner name correctness) was previously undocumented.
