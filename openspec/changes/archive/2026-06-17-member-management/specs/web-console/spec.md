## ADDED Requirements

### Requirement: Member row actions

The Members page SHALL provide a per-row actions menu. For a **pending** member it SHALL
offer resend-invitation and cancel-invitation actions; for an **active** member it SHALL
offer a remove action. Resend SHALL call the resend-invitation operation and cancel/remove
SHALL call the remove-member operation.

#### Scenario: Pending member can be resent or cancelled

- **WHEN** an owner/admin opens the actions menu on a pending member
- **THEN** the menu offers "Reenviar invitación" and "Cancelar invitación"
- **AND** resend sends the invitation email again

#### Scenario: Active member can be removed

- **WHEN** an owner/admin opens the actions menu on an active member
- **THEN** the menu offers "Quitar miembro"
- **AND** confirming removes the member from the workspace

### Requirement: Destructive member actions are confirmed

Removing a member or cancelling an invitation SHALL require confirmation via a simple
confirm dialog before the operation runs.

#### Scenario: Confirmation precedes removal

- **WHEN** an owner/admin chooses Quitar miembro or Cancelar invitación
- **THEN** a confirm dialog is shown
- **AND** the operation runs only after the destructive action is confirmed

### Requirement: Invitations collect a required name

The invite form SHALL collect a member name, which is required, and SHALL prevent
submission without it (the apiserver and Identity require a name on invitation).

#### Scenario: Invite without a name is blocked

- **WHEN** an owner/admin submits the invite form without a name
- **THEN** submission is prevented with a validation message
