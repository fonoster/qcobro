## ADDED Requirements

### Requirement: User language preference

The console SHALL let a user choose their language from the supported locales, persist that
choice to their profile, and apply it on load and immediately on change. The persisted
preference is the source of truth; a brand-new user gets the default language.

#### Scenario: Changing language persists and applies immediately

- **WHEN** a user selects a different language
- **THEN** the UI re-renders in that language without a reload
- **AND** the choice is persisted so it is applied again on the next visit, including on another device

#### Scenario: Language is restored on load

- **WHEN** a returning user opens the console
- **THEN** it renders in their saved language without first flashing the default

## MODIFIED Requirements

### Requirement: Internationalization-ready text

The console SHALL render all user-facing text through an internationalization layer rather
than hardcoded literals, and the active language SHALL be configurable. No language SHALL be
assumed as the only option. Every user-facing string on the operator console and the
auth/onboarding screens SHALL resolve through the i18n layer, and the message catalogs for
the supported locales SHALL have identical key sets (no locale missing a key).

#### Scenario: Text resolved via i18n

- **WHEN** a page renders user-facing copy
- **THEN** the copy is resolved through the i18n layer keyed by message identifiers

#### Scenario: Language is configurable

- **WHEN** the configured language is changed
- **THEN** the console renders user-facing text in the selected language without code changes

#### Scenario: Locales are at parity

- **WHEN** the message catalogs are compared across supported locales
- **THEN** every key present in one locale is present in all others
