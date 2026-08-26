# Ship checkpoint — members-owner-name

Started: 2026-08-25
Current stage: DONE — archived 2026-08-26, PR pending

**Scope:** Fix the Members screen showing the workspace owner's email instead of their name.
Root cause: the owner row was built client-side by assuming the _viewer_ is the owner and reading
their decoded ID token (no `name` claim exists there at all). The real fix reads the actual owner
from the workspace's own `owner` field — was already on Identity's wire format, just not typed in
`@fonoster/identity-client` until fonoster/fonoster#878. Also removed a per-row avatar circle found
during review — a second fidelity gap against Pencil's design.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (Playwright)

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :-- | :-------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | New OpenSpec change `members-owner-name` created. `openspec validate` = valid.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1   | Design (Pencil) | done   | Owner row already shows a real name with email as sub-line, no avatar — no design change needed. Two rounds of user review against the live implementation found the code had drifted from this in two ways (owner-name source, and an avatar circle not in the design); both fixed.                                                                                                                                                                                                         |
| 1.5 | Upstream fix    | done   | `@fonoster/identity-client`'s `Workspace` type fixed to expose `owner` — fonoster/fonoster#878, merged, published as `0.22.8`. qcobro's dependency bumped.                                                                                                                                                                                                                                                                                                                                   |
| 2   | Spec reconcile  | done   | Delta spec updated to reflect the corrected fix approach (source from `Workspace.owner`, not `profile.get`). `openspec validate` = valid.                                                                                                                                                                                                                                                                                                                                                    |
| 3   | Build           | done   | `Members.tsx` sources the owner row from `activeWorkspace.owner`; avatar circle + dead `initialsOf` helper removed. typecheck + lint clean.                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Test            | done   | New e2e test in `member-actions.spec.ts`. Took three iterations to get a correctly-scoped locator — the sidebar's `UserMenu` already shows the name correctly via `profile.get`, so a page-wide text match false-positived regardless of the bug; scoping to `<main>` fixed it. Verified the final version fails on pre-fix code and passes on the fix, both confirmed via git stash. Live-verified via Playwright against the real dev stack (seeded account); screenshot sent to the user. |
| 5   | Sync            | done   | Promoted delta → `openspec/specs/workspaces/spec.md` (new "List workspace members" requirement). `openspec validate --all` clean (one pre-existing, unrelated failure elsewhere).                                                                                                                                                                                                                                                                                                            |
| 6   | Archive         | done   | Moved to `openspec/changes/archive/2026-08-26-members-owner-name`.                                                                                                                                                                                                                                                                                                                                                                                                                           |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-26 — Upstream #878 merged and published as `0.22.8`. Bumped `mods/apiserver/package.json`'s
  `@fonoster/identity-client` pin; typecheck went clean immediately (the type gap was the only
  blocker). User reviewed the live fix and flagged a second fidelity gap: a per-row avatar circle
  that isn't part of Pencil's Name Cell (verified directly against the component definition — just
  two stacked text nodes, no avatar). Removed it and the now-dead `initialsOf` helper. Added a
  regression test; it took three tries to scope correctly because `UserMenu`'s sidebar trigger
  already shows the name correctly (via its own `profile.get` fix, unrelated to this bug), causing
  page-wide text-match false positives — scoping to `<main>` (excludes the sidebar) fixed it, then
  reverified with git-stash round-trips that it genuinely fails pre-fix and passes post-fix.
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
  payload builder (`createGetIdTokenPayload.ts`) never includes a `name` claim — only `ref`,
  `email`, `phoneNumber`, verification flags — so `currentUser.name` always falls back to email.
  Regular members read `name` from `workspaces.listMembers`, which pulls it straight from
  Identity's `User` DB row — that's why only the owner is affected.
