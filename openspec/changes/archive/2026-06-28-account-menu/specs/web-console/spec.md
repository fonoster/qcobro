## ADDED Requirements

### Requirement: Post-authentication landing on the workspaces hub

After authenticating, the console SHALL take the user to the workspaces hub (served at
`/workspaces`) rather than directly into a workspace dashboard. The hub lists the user's
workspaces and offers workspace creation. Selecting a workspace SHALL enter that
workspace's dashboard. An authenticated user who has no workspaces SHALL also be routed to
the hub.

#### Scenario: Login lands on the workspaces hub

- **WHEN** a user logs in successfully
- **THEN** they are taken to the workspaces hub at `/workspaces`
- **AND** they are not dropped directly into a workspace dashboard

#### Scenario: Selecting a workspace enters it

- **WHEN** the user selects a workspace card on the hub
- **THEN** the console enters that workspace's dashboard

#### Scenario: Zero-workspace user is routed to the hub

- **WHEN** an authenticated user has no workspaces
- **THEN** the console routes them to the workspaces hub

### Requirement: Workspaces hub account menu

The workspaces hub SHALL provide an account menu, opened from the avatar, that lets the
user manage their account without first selecting or creating a workspace. The menu SHALL
show the user's name and email, and SHALL offer a link to the profile page, a language
switcher, and a log-out action. Logging out SHALL clear the session and return the user to
login.

#### Scenario: Account menu opens from the avatar

- **WHEN** a user clicks the avatar on the workspaces hub
- **THEN** a menu opens showing their name and email
- **AND** options for Profile, language, and Log out

#### Scenario: User can log out from the hub

- **WHEN** the user selects Log out from the account menu
- **THEN** the session is cleared
- **AND** the user is returned to login

#### Scenario: User can switch language from the hub

- **WHEN** the user selects a different language in the account menu
- **THEN** the console applies that language

## MODIFIED Requirements

### Requirement: Contact verification after sign-up

After creating an account, the console SHALL take the user to a contact-verification
screen that sends a code to their email and accepts the code to confirm it. The screen
SHALL allow re-sending the code and SHALL let the user skip verification and continue
into the console (a soft gate). On verifying or skipping, the user SHALL continue into the
console landing on the workspaces hub.

#### Scenario: New account is taken to verification

- **WHEN** a user completes sign-up
- **THEN** they are taken to the contact-verification screen
- **AND** a verification code is sent to their email

#### Scenario: Entering the code completes verification

- **WHEN** the user enters the code from their email and submits
- **THEN** the contact is verified
- **AND** the user proceeds into the console, landing on the workspaces hub

#### Scenario: Code can be resent

- **WHEN** the user chooses "Reenviar código"
- **THEN** a new verification code is sent to their email

#### Scenario: Verification can be skipped

- **WHEN** the user chooses to skip verification
- **THEN** they continue into the console without verifying, landing on the workspaces hub

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
- **AND** the console leaves it, selecting another workspace or routing to the workspaces
  hub when none remain

### Requirement: Profile page

The console SHALL provide a Mi perfil page, reachable from the in-app user menu and from
the account menu on the workspaces hub, where a user can edit their name and phone and see
their email as read-only. Saving SHALL persist the changes and confirm success. The profile
page SHALL be reachable without an active workspace.

#### Scenario: User opens their profile from the menu

- **WHEN** a user selects "Mi perfil" from the user menu or the workspaces-hub account menu
- **THEN** the profile page opens with their name, email (read-only), and phone

#### Scenario: User edits and saves their profile

- **WHEN** a user changes their name or phone and saves
- **THEN** the change is persisted
- **AND** a success indication is shown

#### Scenario: Profile is reachable without a workspace

- **WHEN** a user who has no workspace opens their profile from the account menu
- **THEN** the profile page opens
- **AND** they are not redirected to the workspaces hub

### Requirement: Workspace creation collects currency and timezone

The workspace-creation form on the workspaces hub SHALL collect the new workspace's
**currency** (`USD` | `DOP`) and **timezone** (IANA zone) in addition to its name, and SHALL
submit them so the workspace's settings are configured at creation. All labels go through
the i18n layer.

#### Scenario: Operator sets currency and timezone when creating a workspace

- **WHEN** an operator fills the workspace-creation form with a name, currency, and timezone and submits
- **THEN** the workspace is created with those settings
- **AND** money and campaign wall-clock interpretation use them immediately, without a separate visit to Configuración del espacio
