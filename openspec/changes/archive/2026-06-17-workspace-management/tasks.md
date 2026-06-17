## 1. Workspace rename (apiserver)

- [ ] 1.1 Add a `workspaces.update` (rename) procedure gated by `adminProcedure` (owner/admin), delegating to Identity; validate the new name with the existing workspace-name schema
- [ ] 1.2 Verify rename updates the name in Identity and that a non-admin member is rejected with a forbidden-category error

## 2. Workspace Configuration page (webapp)

- [ ] 2.1 Add a workspace settings route + page: a "General" card with a "Nombre del espacio" field prefilled from the active workspace and a "Guardar cambios" action wired to `workspaces.update`
- [ ] 2.2 On save, refresh the workspace name across the console (sidebar switcher, lists) and show success/error
- [ ] 2.3 Prevent submission of an empty name; all copy via the i18n layer

## 3. User menu (webapp)

- [ ] 3.1 Add a popover off the sidebar profile with: Mi perfil, Configuración del espacio (→ settings), Miembros (→ members), Cerrar sesión
- [ ] 3.2 Wire Miembros and Configuración del espacio to their routes; Cerrar sesión logs out and returns to login
- [ ] 3.3 Verify the Members page is reachable only via this menu (no orphaned nav row)

## 4. Navigation: logo → workspace list (webapp)

- [ ] 4.1 Make the brand logo navigate to the workspace list ("choose a workspace") screen
- [ ] 4.2 Verify it works from any in-workspace page (dashboard, members, settings)

## 5. Workspace list (webapp)

- [ ] 5.1 Show at most three workspace cards plus the "New workspace" card
- [ ] 5.2 Add a gear (bottom-right) on each card linking to that workspace's configuration page
- [ ] 5.3 Remove the "active" badge from cards
- [ ] 5.4 Selecting a card enters the workspace (unchanged); the gear opens its config

## 6. Verification

- [ ] 6.1 End-to-end: user menu → Configuración del espacio → rename → name updates everywhere; logo → workspace list; card gear → config page
- [ ] 6.2 Extend the Playwright e2e to cover rename, and switch the invite test to reach Members via the user menu
- [ ] 6.3 `npm run build`, `typecheck`, and `lint` pass across the workspace
