# workspaces Specification

## Purpose

Defines workspace lifecycle operations available to authenticated operators — creation, naming, member management, and deletion. Workspace operations are delegated to the Fonoster Identity gRPC service.

## Requirements

### Requirement: Invitation acceptance

The apiserver SHALL expose a public `acceptInvitation` procedure that accepts a
signed invite token and proxies the acceptance to the Identity HTTP bridge, which
marks the `WorkspaceMember` record ACTIVE. The procedure SHALL be public (no auth
required) so that both new and existing users can accept an invitation regardless
of their login state.

#### Scenario: Invited user accepts an invitation

- **GIVEN** a workspace member record in PENDING state for the user
- **WHEN** the user submits the signed invite token from their invitation email
- **THEN** the apiserver forwards the token to the Identity HTTP bridge
- **AND** the membership status is set to ACTIVE
- **AND** the workspace now appears in the user's workspace list upon login

#### Scenario: Existing user accepts while already logged in

- **WHEN** an already-authenticated user submits a valid invite token
- **THEN** the membership is accepted
- **AND** the user is redirected to the home page where the new workspace appears

#### Scenario: New user accepts and then logs in

- **WHEN** a new user submits a valid invite token (their account was pre-created at invite time)
- **THEN** the membership is accepted
- **AND** the user is redirected to the login page to authenticate with their credentials

#### Scenario: Invalid or expired token is rejected

- **WHEN** a user submits an invalid or expired invite token
- **THEN** the request is rejected with a bad-request-category error

### Requirement: Workspace deletion

The apiserver SHALL let the **owner** of a workspace permanently delete it, delegating
to Identity's delete operation. Deletion SHALL be restricted to the workspace owner;
admins and ordinary members SHALL NOT be able to delete a workspace.

#### Scenario: Owner deletes a workspace

- **WHEN** a workspace owner deletes the active workspace
- **THEN** the workspace is removed in Identity
- **AND** it no longer appears in the user's list of workspaces

#### Scenario: Admin cannot delete a workspace

- **WHEN** a workspace admin (not the owner) attempts to delete the workspace
- **THEN** the request is rejected with a forbidden-category error

#### Scenario: Member cannot delete a workspace

- **WHEN** an ordinary member attempts to delete the workspace
- **THEN** the request is rejected with a forbidden-category error
