## 1. Shared contracts (`mods/common`)

- [x] 1.1 Add `languageSchema` (enum of supported locales) + `UserSettings` schema/types (userRef, language) and an `updateUserLanguage` input schema
- [x] 1.2 Add the `UserSettingsClient` interface (findUnique/upsert)

## 2. Data model & API (`mods/apiserver`)

- [x] 2.1 Add `UserSettings` Prisma model (`userRef @id`, `language String @default("es")`, timestamps) + migration
- [x] 2.2 `getUserSettings` (seed-on-read) + `updateUserLanguage` validated functions
- [x] 2.3 Expose language on the profile router: `profile.get` returns it; an update persists it (validated, scoped to `ctx.user.ref`)

## 3. Webapp i18n wiring (`mods/webapp`)

- [x] 3.1 Seed the i18n provider from `localStorage` at startup (no flash); reconcile with the server preference after auth and write it back to the cache
- [x] 3.2 Profile page: Language select that persists (server + cache) and applies immediately
- [x] 3.3 Mount the language control where the user expects it (profile; optionally the user menu)

## 4. i18n hygiene (`mods/webapp`)

- [x] 4.1 Route every hardcoded user-facing string on console + auth/onboarding screens through `t()` (keys added to both locales)
- [x] 4.2 Ensure `messages.en` and `messages.es` have identical key sets (no gaps)
- [x] 4.3 Remove i18n keys not referenced anywhere in `src`

## 5. Tests

- [x] 5.1 Unit: `updateUserLanguage` persists a valid language and rejects an unsupported one (validation-failure case)
- [x] 5.2 Unit: `getUserSettings` seeds a default row when none exists
- [x] 5.3 lint + typecheck + unit suite green
