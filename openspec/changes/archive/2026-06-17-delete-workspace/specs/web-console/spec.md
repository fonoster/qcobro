## ADDED Requirements

### Requirement: Workspace Danger Zone is owner-only

The Workspace Configuration page SHALL show a Danger Zone with a delete-workspace
action only to the workspace owner. Admins and members SHALL NOT see it.

#### Scenario: Owner sees the Danger Zone

- **WHEN** the workspace owner opens the configuration page
- **THEN** an "Eliminar espacio" Danger Zone card is shown

#### Scenario: Non-owner does not see the Danger Zone

- **WHEN** an admin or member opens the configuration page
- **THEN** no delete-workspace action is shown

### Requirement: Workspace deletion is type-to-confirm

Deleting a workspace SHALL require the owner to type the confirmation word `ELIMINAR`
before the destructive button is enabled. The dialog SHALL name the workspace being
deleted.

#### Scenario: Confirm button gates on the typed word

- **WHEN** the owner opens the delete dialog
- **THEN** the destructive button is disabled
- **AND** it becomes enabled only once the owner types `ELIMINAR`

#### Scenario: Deletion leaves the workspace

- **WHEN** the owner confirms deletion
- **THEN** the workspace is deleted
- **AND** the console leaves it, selecting another workspace or routing to workspace
  creation when none remain
