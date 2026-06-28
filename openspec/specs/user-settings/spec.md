# user-settings Specification

## Purpose

Per-user settings owned by the application — stored in the app database keyed by the Identity
`userRef`, never in the Identity service. Holds the user's console language preference and
provides its default/seed behavior and read/update operations.

## Requirements

### Requirement: Per-user settings record

The system SHALL store per-user settings in the application database, keyed by the Identity
`userRef`, independent of the Identity service. A `UserSettings` record SHALL have:

- `userRef` — the user's Identity ref (unique, one row per user)
- `language` — the user's preferred console language (a supported locale)
- `createdAt`, `updatedAt`

No setting SHALL be written to or read from the Identity service.

#### Scenario: Settings are stored in the app database, not Identity

- **WHEN** a user's language is read or written
- **THEN** the value comes from the application's `UserSettings` record keyed by `userRef`
- **AND** the Identity service is not modified

### Requirement: Language default and seed on first use

When no `UserSettings` row exists for the user, the system SHALL treat the user as having the
default language and SHALL persist a row on first use so subsequent reads are stable.

#### Scenario: Missing settings resolve to the default language

- **WHEN** a user with no settings row is resolved
- **THEN** their language resolves to the default and a row is persisted with that value

### Requirement: Read and update the user's language

The user SHALL be able to read and update their own `language` through a user-scoped
operation. Updates SHALL be validated against the supported locales and SHALL apply only to
the calling user.

#### Scenario: User updates their language

- **WHEN** a user saves a supported language
- **THEN** their `UserSettings` row is updated and subsequent sessions resolve that language

#### Scenario: Unsupported language is rejected

- **WHEN** an update is submitted with an unsupported locale
- **THEN** it is rejected with a structured validation error and nothing is persisted
