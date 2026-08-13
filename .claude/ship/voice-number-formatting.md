# Ship checkpoint — voice-number-formatting

Started: 2026-08-13
Current stage: 5 — Sync (awaiting approval)

**Scope:** TTS mispronounces bare numbers on the pre-recorded voice channel. Money-typed
render-context fields (`outstandingBalance`, `principalAmount`, `termsAmount`,
`lastPaymentAmount`) become locale-formatted transparently — no new syntax for operators —
while counts stay raw and the existing numeric helpers keep working via locale-aware parsing.
The locale becomes a new workspace-level setting, and a single opt-in `{{digits}}` helper
handles digit-by-digit reading of phones and account refs.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes
(`mods/webapp/.storybook`) · E2E: yes (`playwright.config.ts`, `e2e/`)

**Worktree:** `.claude/worktrees/feat+voice-number-formatting` on branch
`worktree-feat+voice-number-formatting`

| #   | Stage           | Status      | Notes                                                                                      |
| :-- | :-------------- | :---------- | :----------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Change did not exist; proposed via `/opsx:propose`, `openspec validate` green              |
| 1   | Design (Pencil) | skipped     | No UI surface — locale is data-only, settings page unchanged                               |
| 2   | Spec reconcile  | done        | Dropped the locale picker from specs/proposal/tasks; `openspec validate` green             |
| 3   | Build           | done        | Migration verified via a throwaway shadow DB; no console UI                                |
| 4   | Test            | done        | common 167/167, apiserver 310/312 (2 pre-existing env failures); e2e written, not executed |
| 5   | Sync            | in-progress | Awaiting user approval                                                                     |
| 6   | Archive         | pending     |                                                                                            |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-13 — Stage 4: common 167/167 and apiserver 310/312 green. The 2 apiserver failures
  (`apiKeys`, `campaigns.onChange`) are a missing git-ignored `config/qcobro.json`, absent from
  the main checkout too — unrelated to this change. E2E assertion updated in
  `e2e/manual-outreach.spec.ts` but NOT executed: no dev stack (same missing config).
- 2026-08-13 — `localeOf` no longer re-validates against `supportedLocales`: doing so made the
  helpers silently ignore the workspace's own locale. It now only guards a malformed tag
  (`Intl` RangeError). Supported-locale validation stays at the settings boundary.
- 2026-08-13 — Gotcha: `lerna`/`nx` resolves projects to the MAIN checkout, not the worktree
  (`npx lerna list -p` prints `/Users/psanders/Projects/qcobro/mods/*`). Root `npm run
typecheck|test` therefore checks the wrong tree from a worktree — use
  `npm run <script> --workspace @qcobro/<pkg>`. A worktree also needs its own `npm install`.
- 2026-08-13 — Stage 3: money formatted in `buildOutreachContext`; helpers parse via
  locale-aware `toNumber`; `digits` added; locale threaded through the tRPC context, engine,
  evals (default locale — synthetic scenarios have no workspace) and the three inbound paths.
- 2026-08-13 — Stage 2 done: locale is es-DO only (DR-only launch) and application-managed —
  no console picker, no Pencil work, `updateWorkspaceSettingsSchema` untouched. Stage 1 skipped
  for want of a UI surface.
- 2026-08-13 — Stage 0 done: proposal/design/specs/tasks written, `openspec validate` passes.
  Delta specs modify `channel-dispatch` (money formatting, helper parsing, `digits`) and
  `workspace-settings` (new `locale` field).
- 2026-08-13 — Rejected the `Money` wrapper object (`valueOf`/`toString`) in favor of formatted
  strings + locale-aware `toNumber` in the helpers: the context is consumed as plain data by
  `buildAutopilotContextLines`, so a wrapper would silently drop Voz IA prompt lines.
- 2026-08-13 — User decisions: money formatting transparent (no helper); locale is a
  workspace-level setting, not per-template `language`; `digits` ships as the one new helper;
  no automatic post-render speech-normalization safety net.
- 2026-08-13 — Checkpoint created; framing the change.

## Open questions

- Follow-up (not this change): console money display hardcodes `Intl.NumberFormat("es", …)` in
  `Portfolios`, `PortfolioDetail`, `PaymentPromises`, `Home`.
- Follow-up (second market): add the locale picker to the settings page and move `locale` into
  `updateWorkspaceSettingsSchema`.

## Upstream follow-up

After this ships: file an issue against Fonoster proposing TTS text normalization as a flag on
the Say verb, which would eventually make `{{digits}}` unnecessary. Confirm the repo with the
user before opening.
