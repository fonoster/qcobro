# workspace-settings Specification

## Purpose

Per-workspace settings (currency, timezone) owned by the application — stored in the app
database keyed by the Identity `workspaceRef`, never in the Identity service. Provides the
record, its default/seed behavior, and read/update operations consumed by money formatting
and campaign wall-clock interpretation.

## Requirements

### Requirement: Per-workspace settings record

The system SHALL store per-workspace settings in the application database, keyed by the
Identity `workspaceRef`, independent of the Identity service. A `WorkspaceSettings` record
SHALL have:

- `workspaceRef` — the active workspace's access key id (unique, one row per workspace)
- `currency` — the workspace's display/billing currency (`USD` | `DOP`)
- `timezone` — an IANA timezone (e.g. `America/Costa_Rica`)
- `createdAt`, `updatedAt`

No setting SHALL be written to or read from the Identity service.

#### Scenario: Settings are stored in the app database, not Identity

- **WHEN** a workspace's currency or timezone is read or written
- **THEN** the value comes from the application's `WorkspaceSettings` record keyed by
  `workspaceRef`
- **AND** the Identity service is not modified

### Requirement: Settings default and seed on first use

When no `WorkspaceSettings` row exists for the active workspace, the system SHALL treat the
workspace as having default settings — `currency` `USD` and `timezone` equal to a fixed
application default (`DEFAULT_TIMEZONE`) — and SHALL persist that default row on first use so
subsequent reads are stable.

#### Scenario: Missing settings resolve to defaults

- **WHEN** a workspace with no settings row is used
- **THEN** its currency resolves to `USD` and its timezone to the application default
- **AND** a settings row is persisted with those values

### Requirement: Read and update workspace settings

The operator console SHALL be able to read and update the active workspace's `currency` and
`timezone` through a workspace-scoped operation. Updates SHALL be validated against the
shared schema (supported currency, non-empty IANA timezone) and SHALL apply only to the
active workspace.

#### Scenario: Operator updates currency and timezone

- **WHEN** an operator saves a new currency and timezone for the active workspace
- **THEN** the `WorkspaceSettings` row for that workspace is updated
- **AND** subsequent currency formatting and campaign wall-clock interpretation use the new
  values

#### Scenario: Invalid settings are rejected

- **WHEN** an update is submitted with an unsupported currency or an empty timezone
- **THEN** it is rejected with a structured validation error and nothing is persisted
