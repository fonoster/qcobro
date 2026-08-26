## 1. Design (Pencil)

- [x] 1.1 Check the Members screen in pencil.pen: does the owner row's mock data show a name or an
      email? — Already correct (Ana Méndez García / Dueño shows a real name, email as sub-line).
- [x] 1.2 Confirm with the user that the design looks right.
- [x] 1.3 Re-checked after user review of the live implementation: found a second fidelity gap
      (per-row avatar circle) not present in Pencil's Name Cell — removed to match.

## 2. Upstream dependency

- [x] 2.1 Fix `@fonoster/identity-client`'s `Workspace` type to expose `owner` (already on the wire
      via `listWorkspaces`'s Prisma `include`, just never declared). PR: fonoster/fonoster#878.
- [x] 2.2 Merged and published as `0.22.8`; bumped qcobro's `@fonoster/identity-client` dependency.

## 3. Spec reconcile

- [x] 3.1 Confirm the delta spec (`specs/workspaces/spec.md` in this change) matches the final
      design/approach; updated after discovering the real fix (source from `Workspace.owner`, not
      `profile.get` or the decoded ID token).
- [x] 3.2 `openspec validate members-owner-name`.

## 4. Build

- [x] 4.1 webapp: `Members.tsx` sources the owner row's `name`/`email` from the active workspace's
      `owner` field (from `trpc.workspaces.list`, already fetched for `wsName`) instead of the
      decoded ID token (`currentUser`).
- [x] 4.2 webapp: removed the per-row avatar circle and the now-unused `initialsOf` helper (fidelity
      fix, matches Pencil's Name Cell exactly).
- [x] 4.3 typecheck + lint clean.

## 5. Test

- [x] 5.1 New e2e test in `e2e/member-actions.spec.ts`: "the owner's row shows their real name, not
      their email." Verified three times against the real regression before landing on a correct
      locator — a naive page-wide text match false-positived against the sidebar's independently
      correct `UserMenu` (which already reads via `profile.get`); scoping to `<main>` fixed it.
      Confirmed: fails on the pre-fix code, passes with the fix restored.
- [x] 5.2 Live verification via Playwright against the real dev stack (seeded `demo@qcobro.com`
      account): owner's row shows "Demo User", not their email; no avatar circle. Screenshot sent to
      the user for review.
- [x] 5.3 lint + typecheck + test all green.

## 6. Sync — gate first

- [ ] 6.1 Promote the delta spec into `openspec/specs/workspaces/spec.md`.

## 7. Archive — gate first

- [ ] 7.1 Archive the change.
