## ADDED Requirements

### Requirement: List workspace members

The system SHALL let an authenticated member of a workspace list its members. Each row SHALL show
the member's real name and role. The workspace owner's row SHALL show the owner's actual name,
sourced from the workspace's own owner record — never guessed from whichever member is currently
viewing the page, and never a fallback to an email address in place of a name.

#### Scenario: Owner's row shows the owner's real name

- **WHEN** an authenticated member opens the Members screen for a workspace
- **THEN** the owner's row shows the owner's real name
- **AND** the owner's row does not show their email address in place of their name

#### Scenario: A non-owner viewing Members does not see themselves mislabeled as owner

- **WHEN** a workspace admin who is not the owner opens the Members screen
- **THEN** the owner's row still shows the actual owner's name, not the viewing admin's

#### Scenario: Invited members show their real names

- **WHEN** an authenticated member opens the Members screen for a workspace with active members
- **THEN** each active member's row shows their real name and role
