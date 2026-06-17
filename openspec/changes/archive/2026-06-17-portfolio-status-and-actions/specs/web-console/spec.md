## MODIFIED Requirements

### Requirement: Member row actions

The Members page SHALL provide a per-row actions menu. For a **pending** member it SHALL
offer resend-invitation and cancel-invitation actions; for an **active** member it SHALL
offer a remove action. Resend SHALL call the resend-invitation operation and cancel/remove
SHALL call the remove-member operation.

The portfolio list page SHALL likewise provide a per-row ellipsis (⋯) actions menu
replacing individual buttons. The menu SHALL contain: Sincronizar CSV, Editar, and
Eliminar. This establishes the ellipsis menu as the standard row-action pattern for
list pages in the console.

#### Scenario: Pending member can be resent or cancelled

- **WHEN** an owner/admin opens the actions menu on a pending member
- **THEN** the menu offers "Reenviar invitación" and "Cancelar invitación"
- **AND** resend sends the invitation email again

#### Scenario: Active member can be removed

- **WHEN** an owner/admin opens the actions menu on an active member
- **THEN** the menu offers "Quitar miembro"
- **AND** confirming removes the member from the workspace

#### Scenario: Portfolio row ellipsis menu

- **WHEN** an operator clicks ⋯ on a portfolio row
- **THEN** a floating menu offers Sincronizar CSV, Editar, and Eliminar
