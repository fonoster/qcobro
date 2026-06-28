# Language preference in the user profile

## Why

The console is i18n-ready (`messages.{en,es}`, a `t()` layer) but the active language is
ephemeral React state defaulting to Spanish, with no in-app control wired up (a
`LanguageSwitcher` exists only in Storybook). A user cannot choose their language and have
it stick. Separately, ~54 user-facing strings on core screens are still hardcoded Spanish,
violating the "all text through i18n" rule and the product's multilingual intent.

## What Changes

- Add an **app-owned per-user settings** store (`UserSettings`, keyed by the Identity
  `userRef`) holding the user's `language`. No Identity changes.
- The **profile page** lets the user pick their language; saving persists it. The choice is
  the source of truth and is **applied on load and on change**, with a localStorage cache so
  there is no default-language flash before the profile loads.
- Mount a real language control and seed the i18n provider from the persisted preference.
- **i18n hygiene pass:** route every remaining hardcoded user-facing string through `t()`,
  keep `en`/`es` at full key parity, and remove keys no longer referenced anywhere.

## Impact

- Specs: new `user-settings` (per-user language); `web-console` (profile language control,
  language persisted + applied, all text via i18n).
- Code: `@qcobro/common` (user-settings schema/types), `apiserver` (Prisma `UserSettings`
  model + migration, `userSettings`/profile language read+update), `webapp` (provider seeded
  from preference + localStorage, profile language select, de-hardcode core screens).
- Pencil: profile page gains a Language control.
