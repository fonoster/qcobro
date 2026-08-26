## Why

On the Members screen, the workspace owner shows their email address where every other member
shows their real name. The owner's row is built client-side from the logged-in user's decoded ID
token (`mods/webapp/src/lib/auth.tsx`'s `decodeUser`), and Fonoster Identity's ID-token payload
never includes a `name` claim — only `ref`, `email`, `phoneNumber`, and verification flags — so
`currentUser.name` always falls back to email. Regular members don't hit this path: they come from
`workspaces.listMembers`, which reads `name` straight from Identity's `User` table. The owner's real
name already exists in that same table and is already exposed by an endpoint the Members screen
just isn't using: `profile.get` (`ctx.identity.getUser`).

## What Changes

- `Members.tsx` sources the owner row's `name` from `trpc.profile.get` instead of decoding it from
  the ID token.
- No apiserver or Identity changes — `profile.get` already returns the full profile, including
  `name`.
- No spec-level behavior change beyond correctness of what a documented requirement should have
  already covered: the "workspaces" capability's spec currently documents invitation acceptance and
  deletion, but never documented that the member list must show each member's real name (owner
  included) — this change adds that requirement.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `workspaces`: adds a "List workspace members" requirement — the member list SHALL show each
  member's real name, including the owner's, never a fallback to their email/ID-token claims.

## Impact

- `mods/webapp/src/pages/Members.tsx` — owner row's name sourced from `trpc.profile.get`.
- Pencil: the Members screen mock data doesn't currently distinguish an owner row with a real name
  from a member row — check/update so the design matches (owner shows a name, not an email).
