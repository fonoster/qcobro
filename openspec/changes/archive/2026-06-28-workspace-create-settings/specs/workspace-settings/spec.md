## ADDED Requirements

### Requirement: Settings are written at workspace creation

When a workspace is created, the system SHALL persist its `WorkspaceSettings` row from the
currency and timezone supplied at creation. The seed-on-read default behavior remains as a
backstop for workspaces created through any path that does not supply settings.

#### Scenario: Creation persists the chosen settings

- **WHEN** a workspace is created with a chosen currency and timezone
- **THEN** a `WorkspaceSettings` row keyed by its `workspaceRef` is persisted with those values

#### Scenario: A workspace created without supplied settings still resolves

- **WHEN** a workspace is created by a path that supplies no settings (e.g. SDK, invite acceptance, seed)
- **THEN** its settings still resolve via seed-on-read using the column defaults
