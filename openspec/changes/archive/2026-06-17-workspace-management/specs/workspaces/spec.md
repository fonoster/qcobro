## MODIFIED Requirements

### Requirement: Workspace lifecycle

The apiserver SHALL let an authenticated user create a workspace, and list, get, and **rename** the workspaces they belong to, delegating to Identity. The creator SHALL become the workspace owner. Renaming a workspace SHALL be restricted to a workspace owner or admin.

#### Scenario: User creates a workspace

- **WHEN** an authenticated user creates a workspace with a name
- **THEN** a workspace is created in Identity with that user as owner
- **AND** it appears in the user's list of workspaces

#### Scenario: User lists their workspaces

- **WHEN** an authenticated user lists workspaces
- **THEN** only workspaces they own or are a member of are returned

#### Scenario: Owner renames a workspace

- **WHEN** a workspace owner or admin updates the workspace name to a non-empty value
- **THEN** the workspace's name is updated in Identity
- **AND** the new name appears in subsequent lists and gets

#### Scenario: Non-privileged member cannot rename

- **WHEN** an ordinary member attempts to rename the workspace
- **THEN** the request is rejected with a forbidden-category error
