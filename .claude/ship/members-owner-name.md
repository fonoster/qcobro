# Ship checkpoint — members-owner-name

Started: 2026-08-25
Current stage: 3 — Build (blocked on upstream fonoster/fonoster#878)

**Scope:** Fix the Members screen showing the workspace owner's email instead of their name.
Root cause: the owner row is built client-side by assuming the _viewer_ is the owner and reading
their decoded ID token (no `name` claim exists there at all). The real fix reads the actual owner
from the workspace's own `owner` field — already on Identity's wire format, just not typed in
`@fonoster/identity-client` until fonoster/fonoster#878.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (Playwright)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                  |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | New OpenSpec change `members-owner-name` created. `openspec validate` = valid.                                                                                                                                                         |
| 1   | Design (Pencil) | done        | Owner row (Ana Méndez García / Dueño) already shows a real name with email as sub-line — no design change needed. Confirmed with user, including after their own Pencil edit (Roberto's role → Administrador, unrelated to owner row). |
| 1.5 | Upstream fix    | in-progress | `@fonoster/identity-client`'s `Workspace` type fixed to expose `owner` (fonoster/fonoster#878, opened, CI running). Waiting on merge + publish before bumping qcobro's dependency.                                                     |
| 2   | Spec reconcile  | done        | Delta spec updated to reflect the corrected fix approach (source from `Workspace.owner`, not `profile.get`). `openspec validate` = valid.                                                                                              |
| 3   | Build           | pending     | Blocked on #878 publishing.                                                                                                                                                                                                            |
| 4   | Test            | pending     |                                                                                                                                                                                                                                        |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                        |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                        |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-25 — Corrected the fix approach after checking Pencil (per user's explicit ask to use it
  as source of truth) and re-deriving the root cause. The `profile.get`-based fix from Frame was
  wrong in a subtler way than the email-vs-name bug alone: `listMembers` is `workspaceProcedure`
  (any active member, not owner-only), so an admin viewing Members would see _themselves_ mislabeled
  as "Dueño" under the old currentUser-based hack. Found the real data source: `Workspace.owner`
  ({ref,name,email}) is already on Identity's proto/wire and already populated by `listWorkspaces`'s
  Prisma `include`, but `@fonoster/identity-client`'s hand-written `Workspace` TS type never declared
  it. Opened fonoster/fonoster#878 (small, additive, type-only) to fix that upstream first.
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
