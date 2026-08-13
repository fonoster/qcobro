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
- `locale` — a BCP-47 locale tag (e.g. `es-DO`) governing how numbers and amounts are
  formatted for this workspace, including in rendered outreach bodies
- `createdAt`, `updatedAt`

`locale` is application-managed: it is persisted on the record and consumed by formatting,
but it is not operator-editable through the console while exactly one locale is supported.

No setting SHALL be written to or read from the Identity service.

#### Scenario: Settings are stored in the app database, not Identity

- **WHEN** a workspace's currency, timezone or locale is read or written
- **THEN** the value comes from the application's `WorkspaceSettings` record keyed by
  `workspaceRef`
- **AND** the Identity service is not modified

#### Scenario: Locale is not part of the operator-editable settings

- **WHEN** an operator saves the workspace settings form
- **THEN** the submitted payload carries no locale
- **AND** the workspace's persisted locale is unchanged

### Requirement: Settings default and seed on first use

When no `WorkspaceSettings` row exists for the active workspace, the system SHALL treat the
workspace as having default settings — `currency` `USD`, `timezone` equal to a fixed
application default (`DEFAULT_TIMEZONE`), and `locale` equal to a fixed application default
(`DEFAULT_LOCALE`) — and SHALL persist that default row on first use so subsequent reads are
stable.

#### Scenario: Missing settings resolve to defaults

- **WHEN** a workspace with no settings row is used
- **THEN** its currency resolves to `USD`, its timezone to the application default, and its
  locale to the application default
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

### Requirement: Persisted locale is validated

The system SHALL validate a workspace's `locale` against the set of locales the application
supports, and SHALL reject an unsupported tag with a structured validation error rather than
falling back to a different format. Amounts must never be silently formatted for a locale the
deployment has not been verified against.

#### Scenario: An unsupported locale is rejected

- **WHEN** a `WorkspaceSettings` record is written with a locale outside the supported set
- **THEN** it is rejected with a structured validation error and nothing is persisted

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
