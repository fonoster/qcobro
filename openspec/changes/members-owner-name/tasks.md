## 1. Design (Pencil)

- [ ] 1.1 Check the Members screen in pencil.pen: does the owner row's mock data show a name or an
      email? Update it to show a name if it doesn't already, so the design matches the fix.
- [ ] 1.2 Confirm with the user that the design looks right.

## 2. Spec reconcile

- [ ] 2.1 Confirm the delta spec (`specs/workspaces/spec.md` in this change) matches the final
      design; update if the design iteration changed anything.
- [ ] 2.2 `openspec validate members-owner-name`.

## 3. Build

- [ ] 3.1 webapp: `Members.tsx` sources the owner row's `name` from `trpc.profile.get` instead of
      the decoded ID token (`currentUser.name`).
- [ ] 3.2 typecheck + lint clean.

## 4. Test

- [ ] 4.1 Unit/component test covering the owner-row name source, if the existing test setup makes
      that practical.
- [ ] 4.2 E2E / live verification: open the Members screen as the owner, confirm the owner's row
      shows their real name, not their email.
- [ ] 4.3 lint + typecheck + test all green.

## 5. Sync — gate first

- [ ] 5.1 Promote the delta spec into `openspec/specs/workspaces/spec.md`.

## 6. Archive — gate first

- [ ] 6.1 Archive the change.
