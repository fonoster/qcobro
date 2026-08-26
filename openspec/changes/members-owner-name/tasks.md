## 1. Design (Pencil)

- [x] 1.1 Check the Members screen in pencil.pen: does the owner row's mock data show a name or an
      email? — Already correct (Ana Méndez García / Dueño shows a real name, email as sub-line).
- [x] 1.2 Confirm with the user that the design looks right.

## 2. Upstream dependency

- [x] 2.1 Fix `@fonoster/identity-client`'s `Workspace` type to expose `owner` (already on the wire
      via `listWorkspaces`'s Prisma `include`, just never declared). PR:
      fonoster/fonoster#878.
- [ ] 2.2 Once merged and published, bump qcobro's `@fonoster/identity-client` dependency.

## 3. Spec reconcile

- [x] 3.1 Confirm the delta spec (`specs/workspaces/spec.md` in this change) matches the final
      design/approach; updated after discovering the real fix (source from `Workspace.owner`, not
      `profile.get` or the decoded ID token).
- [ ] 3.2 `openspec validate members-owner-name`.

## 4. Build

- [ ] 4.1 webapp: `Members.tsx` sources the owner row's `name`/`email` from the active workspace's
      `owner` field (from `trpc.workspaces.list`, already fetched for `wsName`) instead of the
      decoded ID token (`currentUser`).
- [ ] 4.2 typecheck + lint clean.

## 5. Test

- [ ] 5.1 Unit/component test covering the owner-row name source, if the existing test setup makes
      that practical.
- [ ] 5.2 E2E / live verification: open the Members screen as the owner, confirm the owner's row
      shows their real name, not their email. If practical, also verify as a non-owner admin that
      the owner's row still shows the real owner's name, not the viewer's.
- [ ] 5.3 lint + typecheck + test all green.

## 6. Sync — gate first

- [ ] 6.1 Promote the delta spec into `openspec/specs/workspaces/spec.md`.

## 7. Archive — gate first

- [ ] 7.1 Archive the change.
