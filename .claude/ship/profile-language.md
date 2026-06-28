# Ship checkpoint — profile-language

Started: 2026-06-28
Current stage: 6 — Archived (done)

**Scope:** Add an app-owned per-user `UserSettings` store (keyed by Identity `userRef`,
not Identity) holding the user's `language`. The profile page lets the user pick a language;
it persists server-side (source of truth) + a localStorage cache, and applies on load and on
change. Includes the i18n hygiene pass: all hardcoded user-facing strings through `t()`,
`en`/`es` at key parity, dead keys removed.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo-root `pencil.pen`) · Storybook: yes (@qcobro/webapp) · E2E: yes (root `playwright.config.ts`)

| #   | Stage           | Status                 | Notes                                                                                                                                                                                                                                                                                                               |
| :-- | :-------------- | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done                   | Artifacts authored + valid (proposal/design/tasks/2 specs). i18n today: messages.{en,es} balanced 432 each; language is ephemeral useState (default es), no persistence; LanguageSwitcher only in Storybook; ~54 hardcoded literals on core screens                                                                 |
| 1   | Design (Pencil) | done                   | Idioma select added to the Mi perfil card (K5dyFn), approved                                                                                                                                                                                                                                                        |
| 2   | Spec reconcile  | done                   | No drift — design matches the authored deltas; specs valid                                                                                                                                                                                                                                                          |
| 3   | Build           | done                   | common (userSettings schema/types) + apiserver (UserSettings model+migration applied, getUserSettings/updateUserLanguage, profile.get/setLanguage) + webapp (provider localStorage seed+persist, AuthedLayout reconcile, Profile language select, full de-hardcode). i18n: en/es 451 parity, 0 unused, no hardcoded |
| 4   | Test            | unit done; e2e skipped | 125 apiserver tests (getUserSettings seed + updateUserLanguage validation-failure). build/lint/test green. e2e skipped per standing preference                                                                                                                                                                      |
| 5   | Sync            | done                   | user-settings (new) + web-console (language pref + i18n parity/all-via-i18n) promoted; valid                                                                                                                                                                                                                        |
| 6   | Archive         | done                   | changes/archive/2026-06-28-profile-language                                                                                                                                                                                                                                                                         |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-28 — Decisions: storage = app-owned UserSettings keyed by userRef + localStorage cache (server is source of truth); no automated i18n guardrail test (one-time cleanup). Default language `es` via column default.
