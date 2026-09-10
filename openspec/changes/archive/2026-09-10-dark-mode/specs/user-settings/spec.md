## MODIFIED Requirements

### Requirement: Per-user settings record

The system SHALL store per-user settings in the application database, keyed by the Identity
`userRef`, independent of the Identity service. A `UserSettings` record SHALL have:

- `userRef` — the user's Identity ref (unique, one row per user)
- `language` — the user's preferred console language (a supported locale)
- `theme` — the user's preferred console appearance, one of `system`, `light`, `dark`
- `createdAt`, `updatedAt`

No setting SHALL be written to or read from the Identity service.

#### Scenario: Settings are stored in the app database, not Identity

- **WHEN** a user's language or theme is read or written
- **THEN** the value comes from the application's `UserSettings` record keyed by `userRef`
- **AND** the Identity service is not modified

## ADDED Requirements

### Requirement: Appearance default and seed on first use

When no `UserSettings` row exists for the user, the system SHALL treat the user as having
the default appearance `system` and SHALL persist a row on first use so subsequent reads
are stable.

#### Scenario: Missing settings resolve to the default appearance

- **WHEN** a user with no settings row is resolved
- **THEN** their theme resolves to `system` and a row is persisted with that value

### Requirement: Read and update the user's appearance

The user SHALL be able to read and update their own `theme` through a user-scoped
operation. Updates SHALL be validated against the supported values (`system`, `light`,
`dark`) and SHALL apply only to the calling user.

#### Scenario: User updates their appearance

- **WHEN** a user saves a supported appearance value
- **THEN** their `UserSettings` row is updated and subsequent sessions resolve that value

#### Scenario: Unsupported appearance value is rejected

- **WHEN** an update is submitted with a value outside `system | light | dark`
- **THEN** it is rejected with a structured validation error and nothing is persisted
