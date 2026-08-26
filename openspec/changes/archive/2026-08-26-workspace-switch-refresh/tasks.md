## 1. Design (Pencil)

- [x] 1.1 Skipped — this is a pure state-management/data-freshness bug, no visual/copy change.

## 2. Spec reconcile

- [x] 2.1 `openspec validate workspace-switch-refresh`.

## 3. Build

- [x] 3.1 webapp: `setWorkspace` (`mods/webapp/src/lib/auth.tsx`) resets the query cache after
      updating the active workspace.
- [x] 3.2 typecheck + lint clean.

## 4. Test

- [x] 4.1 New e2e spec `e2e/workspace-switch-refresh.spec.ts` — verified it fails on the pre-fix
      code (stashed the fix, confirmed a real failure) and passes with the fix restored.
- [x] 4.2 lint + typecheck + test all green.

## 5. Sync — gate first

- [ ] 5.1 Promote the delta spec into `openspec/specs/web-console/spec.md`.

## 6. Archive — gate first

- [ ] 6.1 Archive the change.
