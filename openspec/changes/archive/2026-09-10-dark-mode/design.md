## Context

The webapp (`mods/webapp`) is a React 19 + Vite + **Tailwind CSS v4** SPA. There is **no
`tailwind.config.*`** — Tailwind runs purely through `@tailwindcss/vite`. `src/index.css`
declares a handful of `--color-*` custom properties on `:root`, but no `@theme` block, so
they generate no utilities and are almost entirely unused: components hardcode raw palette
classes (`bg-white`, `text-slate-900`, `bg-emerald-500`, `border-slate-200`, …) across
~30+ component and page files. There is no theme toggle, no `dark:` usage, no
`prefers-color-scheme` handling anywhere.

The nearest working analog is the **language** preference: an `I18nProvider`
(`src/lib/i18n.tsx`) holds runtime state + a `localStorage` cache (`qcobro.language`), the
server profile is the source of truth, and `AuthedLayout.tsx` reconciles the cached choice
to the server value once `profile.get` resolves. Persistence is app-owned: auth/identity is
delegated to the external Fonoster Identity gRPC service ("never modified"), while per-user
UI preferences live in QCobro's own Postgres `UserSettings` table keyed by the Identity
`userRef` (`createGetUserSettings` seeds a default row on first read).

Design is done spec-first in `pencil.pen`. It already has a `Mode` theme axis, but it is
malformed: the axis has only a `Dark` value and those entries hold the **light** hexes. A
`Dark` dashboard sample (`fxWGD`) carries the approved dark palette, and Brand Identity has
an on-dark logo variant (`oxYpa`).

## Goals / Non-Goals

**Goals:**

- A per-user tri-state appearance preference (`system | light | dark`, default `system`),
  persisted app-side exactly like `language`.
- OS-following behavior before any manual choice, and live OS-following while `system` is
  selected.
- No flash of the wrong theme on first paint.
- Every console screen and component renders correctly in both themes, driven by semantic
  color tokens rather than raw palette classes.
- Theme-aware brand logo (on-dark treatment in dark mode) at every call site.
- Storybook can preview any component in light/dark/system.
- Pencil: a corrected `Mode` axis with real Light/Dark pairs, the Design System and key
  screens rebound to those variables, the dark palette documented in Brand Identity, and a
  themed logo component.

**Non-Goals:**

- Per-workspace or admin-set themes; themes remain per-user.
- A dark treatment for the marketing site (`site/`), brochure, OG banner, favicon, or the
  docs diagram kit.
- Automatic time-of-day switching.
- Theming the always-dark auth brand panel (`AuthBrandPanel`) beyond its existing look.
- Persisting the preference in the Identity service (explicitly forbidden).

## Decisions

### D1 — Persist `theme` in `UserSettings`, mirroring `language`

Add a `theme String @default("system")` column to the `UserSettings` Prisma model, a
`themeSchema = z.enum(["system","light","dark"])` and `updateUserThemeSchema` in
`@qcobro/common`, a `createUpdateUserTheme` validated function (a near-verbatim copy of
`createUpdateUserLanguage`), and `profile.get` returning `theme` plus a `profile.setTheme`
mutation.

- **Sibling `setTheme` over generalizing `setLanguage` → `setUserSettings`.** Smaller diff,
  matches the established one-field-per-mutation style, no churn on the existing language
  path or its tests.
- **String column default over a Prisma enum.** `language` is already a plain `String`;
  `getUserSettings` seeds defaults via `upsert({ create: {} })` and relies on column
  defaults. A `String` keeps that path untouched; validation lives in Zod at the edge, per
  the validated-function convention.

### D2 — `data-theme` attribute + Tailwind v4 `@custom-variant`

`src/index.css` gains:

```css
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
@theme {
  /* semantic tokens → utilities */
}
```

`:root` holds light token values; `:root[data-theme=dark]` overrides them. The provider
writes the **resolved** theme (`light` or `dark`, never `system`) to
`document.documentElement.dataset.theme`.

- **`data-theme` over a `.dark` class**: one attribute carries a positive value for both
  themes, reads cleanly in devtools, and matches how Storybook's decorator will set it.
- **Semantic tokens over raw `dark:` variants everywhere**: a token layer (`bg-surface`,
  `text-fg`, `border-border`, `bg-primary`, …) means each component is written once and
  both themes come from the token definitions — far less per-component churn than adding a
  `dark:` counterpart to every existing class, and it matches the Pencil variable model
  1:1.

### D3 — `ThemeProvider` modeled on `I18nProvider`

New `src/lib/theme.tsx`: `THEME_STORAGE_KEY = "qcobro.theme"`, `themes`, `defaultTheme`,
`readStoredTheme()`, `ThemeProvider`, `useTheme()` → `{ preference, resolved, setTheme }`.
`resolved` derives from `preference` and, when `preference === "system"`, a
`matchMedia("(prefers-color-scheme: dark)")` subscription. An effect applies `resolved` to
`documentElement`. Mounted in `main.tsx` just inside `QueryClientProvider` (so it sits
above i18n/auth and can later be reconciled from tRPC). `AuthedLayout.tsx` gets a second
reconcile effect next to the language one, snapping `preference` to `profile.get`'s `theme`.

### D4 — No-flash pre-hydration script

A tiny IIFE in `mods/webapp/index.html` reads `localStorage["qcobro.theme"]` + `matchMedia`
and sets `data-theme` before the bundle loads. It duplicates ~5 lines of resolve logic;
that is the accepted cost of eliminating the flash. The provider re-asserts the same value
on mount, so the script drifting out of sync self-heals within one frame.

### D5 — Full token migration in this change

Every file under `src/components/**` and `src/pages/**` moves off raw palette classes onto
semantic tokens, following a fixed mapping (see tasks). Order: design-system primitives
(`src/components/ui/*`) → layout shells → pages → `Logo`. A `grep` gate (no
`(bg|text|border)-(white|slate|emerald|gray|zinc|neutral)-<n>` left) plus an optional
ESLint `no-restricted-syntax` rule keep it from regressing.

- **Full migration over a hybrid/minimal `dark:` pass** (user decision): leaves a single
  coherent token system, no half-themed pages, and no long tail of `slate-*` literals that
  never converge. Cost is a wide diff touching most of the component/page tree, mitigated
  by doing primitives first and verifying each in Storybook.

### D6 — Simplified, theme-aware `Logo` (wordmark-only, both themes)

The QCobro logo is simplified to the **"QCobro" wordmark only** — no "Q" mark pill, no
"by Fonoster" tagline — in **both** themes, at a slightly larger size (matches the
`fxWGD` dark sample: ~26px, letter-spacing −0.6). `src/components/Logo.tsx` drops the mark
and tagline markup and renders a single wordmark in `text-fg`, so it is dark ink in light
and near-white in dark, and every bare `<Logo />` call site (`AuthedLayout`,
`AccountLayout`, `SignUp`, `ForgotPassword`, `ResetPassword`, `VerifyContact`) adapts with
no prop change. The `variant="white"` prop is kept only to force white on the always-dark
`AuthBrandPanel`. Pencil `Comp/Logo` is simplified the same way and its wordmark bound to
`$--foreground`; Brand Identity's lockup/variants and the on-dark sample are updated to the
wordmark-only form.

### D7 — Storybook global theme

`.storybook/preview.tsx` gets `globalTypes.theme` (`system | light | dark`, default
`light`) and a decorator that sets `documentElement.dataset.theme` from
`context.globals.theme` (resolving `system` via `matchMedia`), alongside the existing
`I18nProvider`. The hardcoded `backgrounds.default: "light"` is replaced by a wrapper that
paints `bg-bg`. A new `Brand/Appearance` story shows the palette + a primitives grid.

### D8 — Pencil: fix the `Mode` axis, rebind, document

`SetVariables` rewrites each **semantic** token as `[{value, theme:{Mode:"Light"}},
{value, theme:{Mode:"Dark"}}]` using the current light hexes and the dark hexes harvested
from `fxWGD` / `--black` / `--surface-dark`. Non-semantic scales (`--slate-*`, `--green-*`,
`brand.*`, `dgm-*`) stay unthemed. The Design System (`ENEOP`) and key composite/screen
frames (`Q15pW` + app screens) are rebound from literal hexes to `$` variables so the
toolbar Mode switch previews the whole console. Brand Identity's Color Palette gains a
"Modo Oscuro" swatch row. The shared logo component's fills become themed variables. A
caption near Brand Identity points at the toolbar Mode switch as the preview control (a
canvas element cannot itself toggle a theme).

## Risks / Trade-offs

- **Wide diff / visual regressions from the full migration** → do primitives first and
  review each component in Storybook in both themes before touching pages; keep the token
  mapping table authoritative; land the `grep` gate before merge.
- **Token mapping loses intent** (e.g. a `slate-500` that was decorative vs. body text) →
  the mapping is role-based, not mechanical; ambiguous spots get a judgement call recorded
  in the PR, not a blind sed.
- **Pre-hydration script drifts from provider logic** → keep it to the minimal resolve
  (stored value else `matchMedia`); the provider re-asserts on mount so any drift corrects
  within a frame; a unit test covers the provider's resolve, and an e2e "no flash" check
  guards the script.
- **Contrast of `#34D399` primary with white text in dark mode** → verify
  `--color-primary-fg` against the dark primary during Pencil design (may need
  `#0B1220` on the button); carry whatever Pencil lands into the CSS tokens.
- **Prisma migration in a worktree** → run `prisma migrate dev` from the worktree with its
  own `npm install` and env; lerna resolves to the main checkout from a worktree, so use
  `--workspace` scripts (per repo CLAUDE.md).
- **Storybook `system` global is environment-dependent** → default the toolbar to `light`
  so snapshots/CI are deterministic; `system` is opt-in for manual review.

## Migration Plan

1. Ship shared-schema + apiserver changes (additive column with a default; existing rows
   backfill to `system` automatically). Safe to deploy ahead of the webapp.
2. Deploy the webapp: users with no stored preference get `system` → identical to today
   unless their OS is dark.
3. Rollback: revert the webapp bundle; the `theme` column and `setTheme` route are inert
   without a client calling them. The column can stay (harmless) or be dropped in a
   follow-up migration.

## Open Questions

- Final `--color-primary-fg` value on the dark primary — resolved during Pencil design
  (D8) by contrast check.
- Whether to also add a quick theme toggle to the user/account menu, or keep the control
  only in **Mi perfil** for v1 (leaning: profile only, menu toggle as a fast follow).
