## ADDED Requirements

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
