## ADDED Requirements

### Requirement: Profile page

The console SHALL provide a Mi perfil page, reachable from the user menu, where a user
can edit their name and phone and see their email as read-only. Saving SHALL persist the
changes and confirm success.

#### Scenario: User opens their profile from the menu

- **WHEN** a user selects "Mi perfil" from the user menu
- **THEN** the profile page opens with their name, email (read-only), and phone

#### Scenario: User edits and saves their profile

- **WHEN** a user changes their name or phone and saves
- **THEN** the change is persisted
- **AND** a success indication is shown

### Requirement: Account deletion is type-to-confirm

The profile page SHALL offer an account-deletion Danger Zone whose destructive button is
enabled only after the user types `ELIMINAR`. On success the session SHALL be cleared and
the user returned to login.

#### Scenario: Confirm button gates on the typed word

- **WHEN** the user opens the delete-account dialog
- **THEN** the destructive button is disabled
- **AND** it becomes enabled only once the user types `ELIMINAR`

#### Scenario: Deleting the account ends the session

- **WHEN** the user confirms account deletion
- **THEN** the account is deleted
- **AND** the session is cleared and the user is returned to login
