## 1. Identity client (Fonoster)

- [x] 1.1 Add `deleteWorkspace(ref, token)` to `@fonoster/identity-client` (calls `DeleteWorkspace`)

## 2. Workspace deletion (apiserver)

- [x] 2.1 Add `deleteWorkspaceSchema` to `@qcobro/common`
- [x] 2.2 Add an `ownerProcedure` (owner-only) to the tRPC layer
- [x] 2.3 Add `workspaces.delete` gated by `ownerProcedure`, delegating to Identity

## 3. Danger Zone (webapp)

- [x] 3.1 Add an owner-gated Danger Zone card to the configuration page (role read from the access token)
- [x] 3.2 Type-to-confirm dialog: button enabled only after typing `ELIMINAR`; dialog names the workspace
- [x] 3.3 On success, leave the workspace and let AuthedLayout re-select or route to creation

## 4. Design (Pencil)

- [x] 4.1 Danger Zone card on "Configuración del espacio · Página"
- [x] 4.2 "Confirmar · Eliminar (escribe para confirmar)" dialog (already designed)

## 5. Verification

- [x] 5.1 `npm run build`, `typecheck`, `lint` pass (common, apiserver, webapp)
- [x] 5.2 e2e: `e2e/delete-workspace.spec.ts` (owner Danger Zone, type-to-confirm `ELIMINAR`, delete → routes out)
- [x] 5.3 Run e2e green — pending a published `@fonoster/identity-client` with `deleteWorkspace` (CI `npm ci` resolves it)
