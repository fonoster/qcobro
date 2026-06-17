# web-console Specification

## Purpose

TBD - created by archiving change project-foundation. Update Purpose after archive.

## Requirements

### Requirement: React + Vite console shell

The web console SHALL be a React single-page application built with Vite and styled with Tailwind CSS. It SHALL provide an application shell with client-side routing into which feature pages are mounted in later changes.

#### Scenario: App builds and serves

- **WHEN** `npm run build` is executed for the `webapp` package
- **THEN** Vite produces a production build without type or build errors

#### Scenario: Shell provides routing

- **WHEN** the console is loaded
- **THEN** an application shell renders and client-side routing resolves a default route

### Requirement: Type-safe API client wiring

The console SHALL communicate with the apiserver through a tRPC client typed against the apiserver's `AppRouter`, so that API calls are end-to-end type-checked.

#### Scenario: Client is typed against the server

- **WHEN** the console's tRPC client is inspected
- **THEN** it is parameterized by the `AppRouter` type exported by the apiserver

### Requirement: Internationalization-ready text

The console SHALL render all user-facing text through an internationalization layer rather than hardcoded literals, and the active language SHALL be configurable. No language SHALL be assumed as the only option.

#### Scenario: Text resolved via i18n

- **WHEN** a page renders user-facing copy
- **THEN** the copy is resolved through the i18n layer keyed by message identifiers

#### Scenario: Language is configurable

- **WHEN** the configured language is changed
- **THEN** the console renders user-facing text in the selected language without code changes

### Requirement: Contact verification after sign-up

After creating an account, the console SHALL take the user to a contact-verification
screen that sends a code to their email and accepts the code to confirm it. The screen
SHALL allow re-sending the code and SHALL let the user skip verification and continue
into the console (a soft gate).

#### Scenario: New account is taken to verification

- **WHEN** a user completes sign-up
- **THEN** they are taken to the contact-verification screen
- **AND** a verification code is sent to their email

#### Scenario: Entering the code completes verification

- **WHEN** the user enters the code from their email and submits
- **THEN** the contact is verified
- **AND** the user proceeds into the console

#### Scenario: Code can be resent

- **WHEN** the user chooses "Reenviar código"
- **THEN** a new verification code is sent to their email

#### Scenario: Verification can be skipped

- **WHEN** the user chooses to skip verification
- **THEN** they continue into the console without verifying

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

### Requirement: Component development in Storybook

The console SHALL include Storybook so reusable components can be developed and reviewed in isolation.

#### Scenario: Storybook builds

- **WHEN** the Storybook build script is executed for the `webapp` package
- **THEN** a static Storybook is produced without errors
