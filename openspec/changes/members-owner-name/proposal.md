## Why

On the Members screen, the workspace owner shows their email address where every other member
shows their real name. The owner's row is built client-side from the logged-in **viewer's** decoded
ID token (`mods/webapp/src/lib/auth.tsx`'s `decodeUser`), which is wrong in two ways: (1) Fonoster
Identity's ID-token payload never includes a `name` claim — only `ref`, `email`, `phoneNumber`, and
verification flags — so `currentUser.name` always falls back to email; (2) it assumes whoever is
_viewing_ the page is the owner, which isn't true — `listMembers` is gated to any active workspace
member (`workspaceProcedure`), not just the owner, so an admin viewing Members would incorrectly see
_themselves_ labeled "Dueño."

The real fix is to read the actual workspace owner's name from the workspace record itself, not
guess it from the viewer. `Workspace.owner` (`{ref, name, email}`) has been on Identity's wire format
all along — `listWorkspaces` already does `include: { owner: {...} } }` in its Prisma query — but
`@fonoster/identity-client`'s hand-written `Workspace` TypeScript interface never declared the field,
so qcobro had no type-safe way to read it. Fixed upstream in
[fonoster/fonoster#878](https://github.com/fonoster/fonoster/pull/878) (purely additive, no wire
change — the data was already there).

## What Changes

- `Members.tsx` sources the owner row's `name`/`email` from the active workspace's `owner` field
  (already fetched via `trpc.workspaces.list`, reused from the existing `wsName` lookup) instead of
  the viewer's decoded ID token.
- No apiserver changes — the `workspaces.list` procedure already passes the Identity response
  through untouched; only the qcobro-facing type needed the upstream fix.
- Adds a "List workspace members" requirement to the `workspaces` capability spec: this behavior
  (every member's row, owner included, shows their real name) was previously undocumented.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `workspaces`: adds a "List workspace members" requirement — the member list SHALL show each
  member's real name, including the owner's, sourced from the workspace's actual owner record —
  never guessed from whichever member is currently viewing the page.

## Impact

- `mods/webapp/src/pages/Members.tsx` — owner row's name/email sourced from the workspace's `owner`
  field instead of the decoded ID token.
- Upstream dependency: `@fonoster/identity-client`'s `Workspace.owner` type fix
  (fonoster/fonoster#878) must be published before this change is meaningful outside local
  verification.
- Pencil: the Members screen mock data already shows the owner row with a real name (verified) — no
  design change needed.
