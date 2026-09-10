## 1. Design (Pencil, `pencil.pen`)

- [x] 1.1 Rewrite the `Mode` theme axis with `SetVariables`: every semantic token gets a
      `[{value, theme:{Mode:"Light"}}, {value, theme:{Mode:"Dark"}}]` pair — light = current
      hex, dark = value from the approved dark sample (`fxWGD` / `--black` / `--surface-dark`).
      Tokens: `--background`, `--foreground`, `--card`, `--popover`, `--sidebar`,
      `--sidebar-border`, `--sidebar-foreground`, `--sidebar-accent`,
      `--sidebar-accent-foreground`, `--border`, `--input`, `--secondary`,
      `--secondary-foreground`, `--muted-foreground`, `--primary`, `--primary-foreground`,
      `--destructive`, `--color-success(-foreground)`, `--color-info(-foreground)`,
      `--color-warning(-foreground)`, `--color-error(-foreground)`.
- [x] 1.2 Verify `--primary-foreground` contrast on the dark `--primary` (`#34D399`); adjust
      to `#0B1220` if needed. Record the final value for the CSS token layer.
- [x] 1.3 Rebind the Design System Components frame (`ENEOP`) from literal light hexes to the
      `$` semantic variables.
- [x] 1.4 Rebind the Composite Components (`Q15pW`: App Shell, Sidebar, Top Bar, KPI Card,
      Table, Chart Card, User Menu, Account Menu, Logo) and the main app screen frames to the
      `$` semantic variables. Skip marketing/site, brochure, OG banner, favicon, diagram kit,
      and `[DEPRECATED v1]` frames.
- [x] 1.5 Simplify `Comp/Logo` to the "QCobro" wordmark only (no "Q" mark, no "by Fonoster"),
      ~26px / −0.6 tracking, wordmark bound to `$--foreground`. Update Brand Identity's Primary
      Lockup, Variants (collapse to Default + On Dark), and the on-dark sample to match. Applies
      to both themes.
- [x] 1.6 Add a "Modo Oscuro" sub-section to Brand Identity's Color Palette (`clSec`, after
      `kOx9O`) using the existing swatch pattern — one swatch per dark token; grow `clSec` and
      `qCoLo` to fit.
- [x] 1.7 Add a caption near the top of `qCoLo` pointing at the toolbar Mode switch as the
      preview control.
- [x] 1.8 Flip the toolbar Mode Light↔Dark; screenshot Brand Identity + one dashboard in both
      modes; check contrast and that the logo swaps.

## 2. Shared contracts (`mods/common`)

- [x] 2.1 In `src/schemas/userSettings.ts`: add `themeSchema = z.enum(["system","light","dark"])` + `Theme` type; add `theme: themeSchema` to `userSettingsSchema`; add
      `updateUserThemeSchema = z.object({ theme: themeSchema })` + `UpdateUserThemeInput`.
- [x] 2.2 In `src/types/userSettings.ts`: add `theme: Theme` to `UserSettingsRecord`.
- [x] 2.3 Build `@qcobro/common`; confirm the new exports resolve.

## 3. apiserver (`mods/apiserver`)

- [x] 3.1 Add `theme String @default("system")` to the `UserSettings` model in
      `prisma/schema.prisma`.
- [x] 3.2 Run `npx prisma migrate dev --name user_settings_theme` from the worktree; commit
      the generated migration.
- [x] 3.3 Add `src/functions/userSettings/updateUserTheme.ts` — `createUpdateUserTheme(client,
    userRef)` upserting `theme`, wrapped in `withErrorHandlingAndValidation(fn,
    updateUserThemeSchema)` (structure copied from `updateUserLanguage.ts`).
- [x] 3.4 In `src/trpc/routers/profile.ts`: return `theme: settings.theme` from `get`; add a
      `setTheme` protected procedure (`updateUserThemeSchema` → `createUpdateUserTheme`).
- [x] 3.5 Confirm `getUserSettings` still seeds a default row (now including
      `theme: "system"` via the column default) with no code change.

## 4. webapp theming foundation (`mods/webapp`)

- [x] 4.1 In `src/index.css`: add
      `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`, an
      `@theme` block of semantic tokens (`--color-bg`, `--color-surface`, `--color-elevated`,
      `--color-border`, `--color-input`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`,
      `--color-primary`, `--color-primary-hover`, `--color-primary-fg`, `--color-success`,
      `--color-warning`, `--color-danger`, `--color-info` + `-soft` tints), light values on
      `:root`, dark overrides on `:root[data-theme=dark]`; set `body` to `bg-bg text-fg`.
- [x] 4.2 Add `src/lib/theme.tsx`: `THEME_STORAGE_KEY = "qcobro.theme"`, `themes`,
      `defaultTheme = "system"`, `readStoredTheme()`, `ThemeProvider` (resolves `system` via
      `matchMedia`, subscribes while `system`, applies `resolved` to
      `document.documentElement.dataset.theme`, persists on `setTheme`), `useTheme()`.
- [x] 4.3 Add a pre-hydration IIFE to `index.html` that sets `data-theme` from
      `localStorage["qcobro.theme"]` + `matchMedia` before the bundle loads.
- [x] 4.4 Wrap `<ThemeProvider>` in `src/main.tsx` just inside `QueryClientProvider`.
- [x] 4.5 Add a theme reconcile effect to `src/components/AuthedLayout.tsx` next to the
      language one, snapping `preference` to `trpc.profile.get`'s `theme`.

## 5. webapp token migration (`mods/webapp`)

- [x] 5.1 Migrate design-system primitives (`src/components/ui/button.tsx`, `card.tsx`,
      `input.tsx`, `select.tsx`, and any `dialog`/`badge`/`table`/`tabs`) from raw palette
      classes to semantic tokens per the mapping table; verify each in Storybook in both
      themes.
- [x] 5.2 Migrate layout shells: `AuthedLayout.tsx`, `AccountLayout.tsx`, `AccountMenu.tsx`,
      `UserMenu.tsx`, `AuthBrandPanel.tsx`, `AnnouncementBanner.tsx`.
- [x] 5.3 Migrate every page under `src/pages/**`.
- [x] 5.4 Rewrite `src/components/Logo.tsx` to the wordmark-only form (drop the mark pill and
      "by Fonoster"; single `<span>QCobro</span>`, larger, `text-fg` so it themes). Keep
      `variant="white"` to force white on `AuthBrandPanel`; leave the bare `<Logo />` call sites
      unchanged. Update `Logo.stories.tsx`.
- [x] 5.5 Run the grep gate:
      `grep -rE "(bg|text|border)-(white|slate|emerald|gray|zinc|neutral)-[0-9]" src/` is
      empty (or a short documented allowlist); optionally add an ESLint `no-restricted-syntax`
      rule.

## 6. webapp appearance control (`mods/webapp`)

- [x] 6.1 Add i18n keys to **both** `en` and `es` in `src/lib/i18n.tsx`:
      `profile.field.appearance`, `profile.appearance.system`, `profile.appearance.light`,
      `profile.appearance.dark`.
- [x] 6.2 In `src/pages/Profile.tsx`: add `const setThemeMut = trpc.profile.setTheme.useMutation()`
      and a `SelectGroup id="profile-appearance"` after the language select;
      `onAppearanceChange(next)` mirrors `onLanguageChange` (`setTheme` + optimistic
      `utils.profile.get.setData` + `setThemeMut.mutate({ theme }, { onSettled: invalidate })`).

## 7. Storybook (`mods/webapp/.storybook`)

- [x] 7.1 In `preview.tsx`: add `globalTypes.theme` toolbar (`system | light | dark`,
      default `light`) + a decorator setting `documentElement.dataset.theme` from
      `context.globals.theme` (resolving `system` via `matchMedia`), alongside `I18nProvider`;
      replace `backgrounds.default` with a `bg-bg` wrapper.
- [x] 7.2 Update `Logo.stories.tsx` / `AuthBrandPanel.stories.tsx` dark stories to the new
      toggle.
- [x] 7.3 Add `Theme.stories.tsx` (`Brand/Appearance`): palette swatches + a primitives grid.

## 8. Tests

- [x] 8.1 apiserver unit (`node --test`): `updateUserTheme` happy path + invalid-enum
      rejection (mirror `updateUserLanguage.test.ts`).
- [x] 8.2 apiserver unit: extend `getUserSettings.test.ts` to assert the seeded default
      includes `theme: "system"`.
- [x] 8.3 common: schema tests for `themeSchema` / `updateUserThemeSchema` if that package
      has a schema suite.
- [skip] 8.4 webapp unit — no unit runner wired in mods/webapp; covered by e2e: `ThemeProvider` — `system` resolves from
  `matchMedia`, a manual pin wins, choice persisted/re-read, `data-theme` applied.
- [x] 8.5 e2e: extend `e2e/profile.spec.ts` — set Dark → `html[data-theme="dark"]` + known
      surface bg → reload persists → set System follows emulated `prefers-color-scheme` →
      second browser context for the same user still has the preference; add a no-flash check.

## 9. Sync & wrap

- [x] 9.1 `openspec validate dark-mode --strict` passes.
- [x] 9.2 `npm run test` (lerna: common + apiserver) green; webapp `npm run build` clean;
      `npm run test:e2e` green with the dev stack up.
- [x] 9.3 `/opsx:sync` deltas into `user-settings` and `web-console` main specs.
- [x] 9.4 Archive via `/ps:ship` / `/opsx:archive`; remove the worktree.
