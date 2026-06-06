## ADDED Requirements

### Requirement: Workspace lifecycle

The apiserver SHALL let an authenticated user create a workspace, and list, get, and update the workspaces they belong to, delegating to Identity. The creator SHALL become the workspace owner.

#### Scenario: User creates a workspace

- **WHEN** an authenticated user creates a workspace with a name
- **THEN** a workspace is created in Identity with that user as owner
- **AND** it appears in the user's list of workspaces

#### Scenario: User lists their workspaces

- **WHEN** an authenticated user lists workspaces
- **THEN** only workspaces they own or are a member of are returned

### Requirement: Member invitations with a role

A workspace owner or admin SHALL be able to invite a person to the workspace by email with an assigned role. The invitation SHALL be recorded as a pending membership and an invitation email SHALL be sent (captured by the development mailer locally). Owners/admins SHALL be able to resend a pending invitation.

#### Scenario: Owner invites a member with a role

- **WHEN** an owner invites an email to the workspace with a chosen role
- **THEN** a pending membership with that role is created in Identity
- **AND** an invitation email is sent (captured by the development mailer in local runs)

#### Scenario: Non-privileged member cannot invite

- **WHEN** an ordinary member attempts to invite someone
- **THEN** the request is rejected with a forbidden-category error

#### Scenario: Pending invitation can be resent

- **WHEN** an owner or admin resends a pending invitation
- **THEN** the invitation email is sent again for that pending membership

### Requirement: Membership management

The apiserver SHALL let owners/admins list the members of a workspace and remove a member, delegating to Identity. Accepting an invitation SHALL transition the membership from pending to active.

#### Scenario: List members

- **WHEN** an owner or admin lists members of their workspace
- **THEN** each member is returned with their role and status

#### Scenario: Accepting an invitation activates membership

- **WHEN** an invited user accepts the invitation
- **THEN** their membership status becomes active
- **AND** they can access the workspace

#### Scenario: Remove a member

- **WHEN** an owner or admin removes a member from the workspace
- **THEN** that membership is removed and the user can no longer access the workspace
