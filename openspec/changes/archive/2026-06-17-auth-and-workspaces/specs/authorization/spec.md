## ADDED Requirements

### Requirement: Access tokens are verified locally

The apiserver SHALL verify the RS256 access token on each request using Identity's public key (obtained via the Identity `GetPublicKey` method and cached), without a per-request round-trip to Identity for verification. Requests with a missing, malformed, or expired token SHALL be treated as unauthenticated.

#### Scenario: Valid token authenticates the request

- **WHEN** a request carries a valid, unexpired access token
- **THEN** the token signature is verified against Identity's public key
- **AND** the request is treated as authenticated

#### Scenario: Invalid token is unauthenticated

- **WHEN** a request carries an expired or tampered token
- **THEN** verification fails and the request is treated as unauthenticated

### Requirement: Authenticated and workspace-scoped procedures

The apiserver SHALL provide a protected procedure that requires an authenticated user, and a workspace-scoped procedure that additionally requires an active workspace in which the user is a member. The workspace-scoped procedure SHALL reject requests where the caller is not a member of the active workspace.

#### Scenario: Protected procedure requires authentication

- **WHEN** an unauthenticated request calls a protected procedure
- **THEN** it is rejected with an unauthorized-category error

#### Scenario: Workspace procedure requires membership

- **WHEN** an authenticated user calls a workspace-scoped procedure for a workspace they do not belong to
- **THEN** the request is rejected with a forbidden-category error

#### Scenario: Member access is granted

- **WHEN** an authenticated member calls a workspace-scoped procedure for their active workspace
- **THEN** the procedure executes with the user, workspace, and role available in context

### Requirement: Role-based access enforcement

Workspace-scoped procedures SHALL enforce role-based access using the caller's role in the active workspace, so that actions restricted to owners or admins (e.g. removing members, deleting the workspace) are denied to ordinary members.

#### Scenario: Privileged action denied to member

- **WHEN** a member (non-admin) attempts an owner/admin-only action
- **THEN** the request is rejected with a forbidden-category error

#### Scenario: Privileged action allowed for admin

- **WHEN** a workspace owner or admin performs an admin-only action
- **THEN** the action is permitted
