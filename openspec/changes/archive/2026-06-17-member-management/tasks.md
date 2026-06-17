## 1. Members row actions (webapp)

- [x] 1.1 Add a per-row `⋯` actions menu on Miembros
- [x] 1.2 Pending members → Reenviar invitación (`workspaces.resendInvitation`) + Cancelar invitación (`workspaces.removeMember`)
- [x] 1.3 Active members → Quitar miembro (`workspaces.removeMember`)
- [x] 1.4 Gate Cancelar/Quitar behind a reusable simple confirm dialog

## 2. Invite requires a name

- [x] 2.1 Confirm the invite form collects a required `Nombre` (apiserver schema already requires it) and update the Pencil invite modal to match

## 3. Verification

- [x] 3.1 Resend re-sends the invitation email — covered by `e2e/member-actions.spec.ts` (asserts a 2nd Mailpit message); CI uses SMTP→localhost+Mailpit
- [x] 3.2 Cancel/remove updates the member list after the confirm dialog (`utils.workspaces.listMembers.invalidate()` after each mutation; covered by `e2e/member-actions.spec.ts`)
- [x] 3.3 `npm run build`, `typecheck`, `lint` pass
- [x] 3.4 e2e specs use only `0.19.1` client methods, so they run green in CI today (no publish gate)
