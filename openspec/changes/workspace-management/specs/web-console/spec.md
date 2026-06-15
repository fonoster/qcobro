## ADDED Requirements

### Requirement: Workspace navigation and user menu

The console SHALL provide a user menu, opened from the sidebar profile, that exposes the user's profile, the workspace configuration page, the members page, and a sign-out action. The brand logo SHALL navigate to the workspace list.

#### Scenario: User menu exposes account and workspace actions

- **WHEN** the user opens the menu from the sidebar profile
- **THEN** it offers entries to view their profile, open workspace configuration, open members, and sign out

#### Scenario: Members is reachable from the user menu

- **WHEN** the user selects Members from the menu
- **THEN** the members page for the active workspace opens

#### Scenario: Sign out returns to login

- **WHEN** the user selects sign out
- **THEN** the session is cleared and the login screen is shown

#### Scenario: Logo returns to the workspace list

- **WHEN** the user clicks the brand logo from any in-workspace page
- **THEN** the workspace list ("choose a workspace") screen opens

### Requirement: Workspace list presentation

The workspace list SHALL display at most three workspace cards alongside a "new workspace" action, SHALL NOT label any workspace as "active", and each workspace card SHALL offer a direct link to that workspace's configuration.

#### Scenario: At most three workspaces are shown

- **WHEN** the workspace list renders for a user who belongs to more than three workspaces
- **THEN** no more than three workspace cards are shown, plus the new-workspace action

#### Scenario: Card links to configuration

- **WHEN** the user activates the configuration control on a workspace card
- **THEN** that workspace's configuration page opens

#### Scenario: Selecting a card enters the workspace

- **WHEN** the user selects a workspace card body
- **THEN** that workspace becomes the active context and the console opens

### Requirement: Workspace configuration page

The console SHALL provide a workspace configuration page that lets an owner or admin rename the active workspace. Saving SHALL call the workspace rename operation and reflect the new name across the console.

#### Scenario: Owner renames from the configuration page

- **WHEN** an owner edits the workspace name and saves
- **THEN** the workspace rename operation is called
- **AND** the updated name is reflected across the console (sidebar switcher and lists)

#### Scenario: Empty name is rejected

- **WHEN** the user clears the name and attempts to save
- **THEN** submission is prevented with a validation message
