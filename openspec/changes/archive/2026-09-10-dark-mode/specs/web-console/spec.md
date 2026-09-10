## ADDED Requirements

### Requirement: User appearance preference

The console SHALL render in a light or a dark theme. It SHALL let a user choose their
appearance from `System`, `Light`, and `Dark`. Before the user has ever made a choice, the
console SHALL follow the operating system's `prefers-color-scheme`. Choosing `System` SHALL
make the console follow the operating system again, updating live when the OS setting
changes. Choosing `Light` or `Dark` SHALL pin that theme. The persisted preference is the
source of truth; a brand-new user gets `System`.

The choice SHALL be persisted to the user's profile and SHALL be applied on load and
immediately on change, without a reload, including on another device. The console SHALL NOT
flash the wrong theme on first paint.

All user-facing copy introduced for this feature SHALL resolve through the i18n layer, and
the message catalogs for the supported locales SHALL remain at parity (no locale missing a
key).

#### Scenario: New user follows the operating system

- **WHEN** a user who has never chosen an appearance opens the console
- **AND** the operating system is set to dark
- **THEN** the console renders in the dark theme

#### Scenario: Choosing a theme persists and applies immediately

- **WHEN** a user selects `Dark` in their profile
- **THEN** the console re-renders in the dark theme without a reload
- **AND** the choice is persisted so it is applied again on the next visit, including on
  another device

#### Scenario: System option re-follows the operating system

- **WHEN** a user selects `System`
- **AND** the operating system appearance is later toggled
- **THEN** the console theme follows the operating system without a reload

#### Scenario: No flash of the wrong theme

- **WHEN** the console loads with a persisted or OS-derived theme
- **THEN** the first paint is already in that theme

### Requirement: Theme-aware brand logo

The console's brand logo SHALL be the "QCobro" wordmark alone — no separate mark and no
tagline — and its color SHALL follow the active theme's primary foreground, so it reads as
dark ink in the light theme and near-white in the dark theme, wherever the logo appears.
The one exception is a surface that is always dark regardless of theme (the auth brand
panel), where the logo SHALL always render light.

#### Scenario: Logo adapts to the dark theme

- **WHEN** the console is rendered in the dark theme
- **THEN** every brand logo instance renders the "QCobro" wordmark in the near-white
  foreground color

#### Scenario: Logo on an always-dark surface

- **WHEN** the logo is shown on the auth brand panel in either theme
- **THEN** it renders light
