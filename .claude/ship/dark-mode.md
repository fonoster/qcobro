# Ship checkpoint — dark-mode

Started: 2026-09-10
Current stage: 6 — Archive (done; PR #163 open, awaiting CI + merge)

**Scope:** Bring dark mode to the QCobro operator console. Add a per-user appearance
preference (tri-state System / Light / Dark, default System), persisted app-side in
`UserSettings` exactly like `language`; before any manual choice the console follows the OS
`prefers-color-scheme`, and "System" keeps following it live. A semantic color-token layer
replaces raw palette classes across every component and page, the brand logo becomes
theme-aware, Storybook gains a theme toggle, and Pencil's `Mode` axis is corrected to real
Light/Dark pairs with the Design System + key screens rebound to it.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes
(`mods/webapp/.storybook/`) · E2E: yes (`playwright.config.ts` + `e2e/`)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Artifacts written & validated (`openspec validate dark-mode --strict` ok). Worktree `feat/dark-mode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1   | Design (Pencil) | done    | Mode axis fixed (24 tokens + `--brand-green`); ENEOP already tokenized; Q15pW + ~1663 nodes across all in-scope app screens rebound; Call Bar HUD + Portal brand fixed; dark-mode swatch section + preview caption; logo simplified to wordmark-only. User reviewed incrementally + signed off ("carry on").                                                                                                                                                                                                                                                                                                                                                     |
| 2   | Spec reconcile  | done    | `web-console` logo requirement rewritten to wordmark-only/themed-foreground (+ always-dark auth panel exception). `openspec validate --strict` passes. No other behavior drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Build           | done    | common contracts; apiserver column+migration+function+router; webapp `index.css` token layer + ThemeProvider + no-flash + reconcile; 76-file token migration (grep gate CLEAN); Logo→wordmark-only; Mi perfil appearance select + i18n; Storybook theme toolbar + `Brand/Appearance` story. `--workspace` typecheck + build + eslint + storybook:build all green. Verified both themes in built Storybook via browser.                                                                                                                                                                                                                                           |
| 4   | Test            | done    | Unit GREEN: common 225, apiserver 523. e2e: `profile.spec.ts` (both, incl. new appearance test) PASS against the live stack; caught + fixed a real bug (theme reconcile didn't run on `/profile` — extracted `usePreferenceSync` hook, now called by AuthedLayout + AccountLayout). Full e2e suite: ~20 pass, ~2–7 pre-existing flakes (Fonoster-sync / realtime-streaming timeouts over a 2.4-min serial run, `retries:0`) — verified unrelated: they pass in isolation, a different subset fails each run, none touch theme/logo. Visually validated in the running app: OS-dark default, live switch to Claro with no reload, persistence across full reload. |
| 5   | Sync            | done    | `user-settings` + `web-console` deltas folded into `openspec/specs/**`; `openspec validate --all` clean for both (pre-existing `money-workspace-locale` failure unrelated).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | Archive         | done    | Change moved to `openspec/changes/archive/2026-09-10-dark-mode/`; gone from `openspec list`. 5 commits on `feat/dark-mode`, pushed; PR #163 open. Pending: CI green → squash-merge → worktree + branch cleanup + stop dev servers.                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-09-10 — Stage 4: stood up the live stack for validation. Stopped the stale MAIN-checkout
  apiserver (PID 2531, yesterday's code) and ran the worktree's on :3000; applied the pending
  migration to the shared dev DB (`theme` column live, default 'system'); webapp on :5173.
  Servers left RUNNING for the user to poke at. Bug caught by e2e: theme reconcile only lived
  in AuthedLayout, so `/profile` (AccountLayout) didn't pull the server value after a cache
  clear → extracted `src/lib/preferenceSync.ts` `usePreferenceSync()`, called from both shells;
  removed the duplicated inline effects. common schema test `userSettings.test.ts` added.
- 2026-09-10 — Stage 3 done → Stage 4.

- 2026-09-10 — Worktree gotcha hit: root `npm run typecheck` (lerna) resolves to the MAIN
  checkout (`.../qcobro/mods/webapp`, v1.41.1), not the worktree — its failure
  (`Members.tsx` `.owner`) is pre-existing in main, unrelated. Use `--workspace=` scripts
  for this ship's checks; those are all green in the worktree.
- 2026-09-10 — Pencil green/token subagent DONE. Task 1: Portal del Gestor already ~99%
  tokenized (1 stray); fixed ENEOP `#A7F3D0` strays on Destructive buttons + Alert/Error;
  Q15pW 10 nodes; **extended** the same light-literal-override fix to 15 more Sidebar
  instances (72 nodes) + fixed a double-active-nav-highlight bug. Task 2: Dashboard/Miembros
  already restrained (no change); Portal Llamada activa 9 green→neutral retargets (script
  body, transcript labels, decorative icons); Campaña detalle sidebar de-greened. No new
  tokens, no layout problems introduced. Left alone: Call Bar HUD, channel accents (violet/
  cyan/Google-blue), frozen `c65Qt` dark reference mockup. Aside: Portal "Colgar" button is
  green `$--primary` — semantically odd for hang-up, out of scope, flagged only.
- 2026-09-10 — User feedback on Pencil dispatched to that subagent (agent a2a38b95e5324fdb7):
  (a) tokenize literal-hex stats; (b) too much green in dark, rebalance toward neutral.
- 2026-09-10 — Stage 3 backend slice done + green: `@qcobro/common` (`themeSchema`,
  `updateUserThemeSchema`, `theme` on record) built; apiserver `UserSettings.theme` column
  - hand-authored migration `20260910120000_user_settings_theme`; `createUpdateUserTheme`
    (+ tests); `profile.get` returns `theme`, `profile.setTheme` added. `npm test` common 221
    pass, apiserver 523 pass (after copying `config/qcobro.json` into the worktree).
- 2026-09-10 — Stage 3 webapp foundation: `index.css` rebuilt (TW v4 `@custom-variant dark`
  - `@theme inline` semantic tokens + `:root` / `:root[data-theme=dark]` raw palette);
    `src/lib/theme.tsx` ThemeProvider (system via matchMedia, live OS follow, writes
    `data-theme`); no-flash IIFE in `index.html`; `<ThemeProvider>` in `main.tsx`;
    `AuthedLayout` theme reconcile effect. Token migration script applied to 76 webapp files.

- 2026-09-10 — Fixed Portal del Gestor white header: the "Call Bar" active-call HUD (2
  screens) was an inverted dark surface in the light design; bulk hex→token rebind flipped
  it (`#0F172A`→`$--foreground`, `#F8FAFC`→`$--background`). Reverted the HUD subtree to
  fixed dark values (bar `#1E1E22`/border `#33333A`, light content, solid-red live pill) so
  it stays a dark HUD in both themes. Only 5 non-text nodes repo-wide had picked up
  `$--foreground` as a fill — all in this cluster; rest of the bulk rebind was clean.
- 2026-09-10 — **Logo simplified to wordmark-only ("QCobro", no mark, no "by Fonoster"),
  BOTH themes, ~26px/−0.6** (user call). `Comp/Logo` + Brand Identity updated; webapp
  `Logo.tsx` to be rewritten in Stage 3. design.md D6 + tasks 1.5/5.4 updated.
- 2026-09-10 — Kept `--primary` green `#10B981` + white fg in both themes; `--destructive`
  brightened to `#F87171` for dark; bright `#34D399` reserved for `--brand-green` /
  success-fg / active-nav accents (user confirmed).
- 2026-09-10 — Pencil Stage 1 near-done: Mode axis rewritten (24 semantic tokens Light/Dark
  - new `--brand-green`); ENEOP was already `$`-var driven; Q15pW + all in-scope app screen
    clusters (Dashboard/Carteras, Gestiones/Promesas, Administración, Campañas, Agentes, Auth,
    gestión-detail blocks, Integraciones, Portal del Gestor, Account Menu) rebound (~1607
    nodes). Decks/marketing/brochure/kit/deprecated/diagrams/favicon left out of scope.
    "Dark mode" swatch section + toolbar-Mode preview caption added to Brand Identity.
    Pre-existing clip in `NeB6V` (Integraciones) noted, not caused by this work.
- 2026-09-10 — Stage 0 done → Stage 1. Surfaces detected; checkpoint created.
- 2026-09-10 — Change `dark-mode` proposed: proposal + `user-settings`/`web-console` delta
  specs + design + tasks; `openspec validate --strict` passes.
- 2026-09-10 — Locked decisions: full webapp token migration (not hybrid); Pencil retrofits
  Design System + key screens (not sample only); tri-state System/Light/Dark selector.
- 2026-09-10 — Persist `theme` in `UserSettings` (string col, default "system") with a
  sibling `setTheme` mutation, mirroring `language` — not a generalized `setUserSettings`.
- 2026-09-10 — Theming mechanism: `data-theme` attribute + Tailwind v4 `@custom-variant`
  - `@theme` semantic tokens; `ThemeProvider` modeled on `I18nProvider`; no-flash
    pre-hydration script in `index.html`.
