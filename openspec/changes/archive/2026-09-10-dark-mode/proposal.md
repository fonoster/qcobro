## Why

The operator console renders light-only, with no theme switch and no way for a user to
work in a dark UI. Operators who run long collections shifts and those whose OS is set to
dark have asked for parity with the rest of their tooling. A dark palette has already been
designed and approved in Pencil; this change brings it to the product.

## What Changes

- Add a per-user **appearance** preference — tri-state **System / Light / Dark**, default
  **System** — stored in the app-owned `UserSettings` record (keyed by the Identity
  `userRef`, never written to Identity), mirroring the existing `language` preference.
- Before any manual choice, the console follows the operating system
  (`prefers-color-scheme`). Choosing **System** again re-follows the OS live.
- A manual choice made in **Mi perfil** persists to the user's profile, is the source of
  truth, and applies on load and immediately on change, on every device.
- The console renders every screen and component in the selected theme, driven by semantic
  color tokens (light and dark) rather than hardcoded palette values.
- In dark mode the brand logo uses its on-dark treatment everywhere it appears.
- All new user-facing copy resolves through the i18n layer, with the light and dark
  message catalogs kept at parity.
- Storybook gains a global light/dark/system toggle so every component can be reviewed in
  both themes.

No breaking changes: existing users with no stored preference transparently get **System**.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `user-settings`: add a `theme` field to the per-user settings record (supported values
  `system | light | dark`, default `system`, seeded on first use like `language`), and a
  user-scoped read/update operation for it, validated against the supported values.
- `web-console`: add an appearance/theme requirement — the console renders in light or
  dark; before any manual choice it follows the OS `prefers-color-scheme`; a manual choice
  is persisted to the profile (source of truth), applied on load and immediately on change,
  on any device; **System** re-follows the OS live; the brand logo uses its on-dark
  treatment in dark mode; new copy is i18n-resolved with catalogs at parity.

## Impact

- **Shared contracts** (`mods/common`): `userSettings` schema/types gain a `theme` enum and
  an update-theme input schema.
- **apiserver** (`mods/apiserver`): `UserSettings` Prisma model gains a `theme` column
  (+ migration); a new `updateUserTheme` validated function; the `profile` tRPC router
  returns `theme` and exposes `setTheme`.
- **webapp** (`mods/webapp`): new semantic color-token layer and `[data-theme]` switching
  in `index.css`; a new `ThemeProvider`; a pre-hydration no-flash script in `index.html`;
  the appearance control in `Profile.tsx`; a theme reconcile effect in `AuthedLayout.tsx`;
  a theme-aware `Logo`; and a migration of every component and page from raw palette
  classes to semantic tokens.
- **Storybook** (`mods/webapp/.storybook`): global theme toolbar + decorator.
- **Design** (`pencil.pen`): the `Mode` theme axis is corrected to real Light/Dark pairs on
  the semantic variables, the Design System and key screens are rebound to those variables,
  the Brand Identity color palette documents the dark set, and the logo component is themed.
- **Tests**: apiserver unit tests for `updateUserTheme`; an extended Playwright
  `profile.spec.ts` covering persistence, reload, System-follows-OS, and cross-device.
