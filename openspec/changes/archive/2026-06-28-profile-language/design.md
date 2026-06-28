## Context

The webapp i18n layer (`mods/webapp/src/lib/i18n.tsx`) holds `language` in `useState`
(default `es`) and exposes `setLanguage`; nothing persists it and no control is mounted.
Workspaces already model app-owned settings keyed by `workspaceRef` (`WorkspaceSettings`);
users are Identity principals exposed in the apiserver as `ctx.user = { ref, accessKeyId }`.

## Goals / Non-Goals

**Goals:**

- Per-user language preference that survives reload and follows the user across devices.
- Apply the preference on app load and immediately on change.
- Bring all user-facing console text through `t()`; keep `en`/`es` at parity; drop dead keys.

**Non-Goals:**

- No Identity changes (no locale field on the Identity user).
- No new languages beyond the existing `en`/`es` (the enum can grow later).
- No automated i18n guardrail test (one-time cleanup this pass, per decision).
- No translation of agent/template _content_ — only console UI strings.

## Decisions

### D1. App-owned `UserSettings` keyed by `userRef`

`model UserSettings { userRef String @id, language String @default("es"), createdAt,
updatedAt }`, mirroring `WorkspaceSettings`. The app owns app-settings; Identity owns
identity. Resolved/seeded on read like the workspace settings (column default supplies the
value for a fresh user), so every user always resolves a language.

_Alternatives:_ a locale field on the Identity user (rejected — never touch Identity);
localStorage only (rejected — not "in the profile", not cross-device).

### D2. Server is source of truth; localStorage is a cache

On app start the provider initializes `language` from `localStorage` (instant, no flash);
after auth the profile's stored language is fetched and reconciled (and written back to
localStorage). Changing the language updates state immediately, persists to the server, and
updates the cache. A logged-out visitor uses the cached or default language.

### D3. Expose language through the profile surface

`profile.get` returns the user's `language`; updating it goes through a validated update
(`profile.setLanguage` / extended `profile.update`). The profile page renders a Language
select (the existing `LanguageSwitcher` pattern), so language lives with the user's other
profile settings. `language` is validated against the supported set (`en` | `es`).

### D4. i18n hygiene to the standard

Every hardcoded user-facing string on console screens routes through `t()` with keys added
to **both** locales. `en`/`es` key sets must be identical. Keys not referenced anywhere in
`src` are removed. (Verified by a one-time scan, not a committed test.)

## Risks / Trade-offs

- **Flash of default language** before the profile resolves → mitigated by the localStorage
  cache seeding the provider synchronously at startup.
- **De-hardcoding scope creep** → bounded to user-facing strings on the operator console +
  auth/onboarding screens; not marketing site or test fixtures.
- **Per-request user-settings lookup** → a single indexed PK read, negligible (same as the
  workspace-settings pattern).

## Migration Plan

1. Add `UserSettings` model + seed-on-read; expose language via the profile router.
2. Seed the i18n provider from localStorage; reconcile with the server preference after auth.
3. Add the profile Language control (persist + apply on change).
4. De-hardcode core screens; reconcile `en`/`es` parity; remove dead keys.

## Open Questions

- None blocking. (Default language for a brand-new user is `es` via the column default; can
  later key off `navigator.language` if desired.)
