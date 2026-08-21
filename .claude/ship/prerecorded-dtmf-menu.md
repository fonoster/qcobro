# Ship checkpoint — prerecorded-dtmf-menu

Started: 2026-08-21
Current stage: 1 — Design (Pencil) in progress; open questions resolved, Pencil work not yet done

**Scope:** Add an optional, per-template DTMF menu to pre-recorded voice calls
(`VOICE_PRERECORDED`): a "repeat" digit that replays the script (capped) and an "opt-out"
digit that ends the call and records `resultado: OPT_OUT` on the gestión — pre-recorded's
first-ever inbound signal. Both digits are independently optional, off by default, configured
per template in the webapp, with an enforced message whenever a digit is enabled and the two
digits required to differ. Source: [issue #88](https://github.com/fonoster/qcobro/issues/88)
plus Pedro's follow-up notes (opt-out digit, UI config, enforced messages, resultado impact).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes
(`mods/webapp/.storybook`) · E2E: yes (Playwright, root `playwright.config.ts`)

**Branch / worktree:** `worktree-feat+prerecorded-dtmf-menu` @
`.claude/worktrees/feat+prerecorded-dtmf-menu`, based on `origin/main` fast-forwarded with
the `docs/sync-archive-contact-log-axes` branch (PR #116, not yet merged at time of writing —
this branch needed its `account-contact-log`/`web-console` main-spec changes as a base).

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                           |
| :-- | :-------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Change scaffolded via `/opsx:propose`: proposal, design (with 5 explicit open questions), 4 delta specs (agent-templates, prerecorded-audio, account-contact-log, web-console), tasks. `openspec validate --strict` passes.                                     |
| 1   | Design (Pencil) | in-progress | Open questions resolved by the user 2026-08-21 (maxRepeats 2, timeout 5s, repeat press sets `camino: ENGAGED` — extended to opt-out too, no default digits, scope = 2 screens). Specs/design/tasks updated to match. Pencil screens themselves not yet touched. |
| 2   | Spec reconcile  | pending     |                                                                                                                                                                                                                                                                 |
| 3   | Build           | pending     |                                                                                                                                                                                                                                                                 |
| 4   | Test            | pending     |                                                                                                                                                                                                                                                                 |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                                                 |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                                                 |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Open questions

None remain. All 5 resolved 2026-08-21 (see design.md § Design gate — resolved 2026-08-21).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-21 — Design gate: user confirmed `maxRepeats` 2, gather timeout 5s, no default digits
  pre-filled, and Pencil scope = exactly the template config form + Gestión detail/Gestiones
  list. User also confirmed a repeat press DOES set `camino: ENGAGED` (reversing the initial
  draft's lean). This session then extended `camino: ENGAGED` to the opt-out press too, as an
  inference for consistency (opt-out is at least as strong an engagement signal as repeat) —
  called out explicitly in design.md decision 4 in case that reach was wrong. Updated design.md,
  all 3 affected delta specs (prerecorded-audio, account-contact-log, web-console — including a
  new MODIFIED delta for web-console's "Gestión detail shows entrega, camino, and resultado"
  requirement, whose "Camino is absent on one-way channels" scenario needed narrowing to SMS
  only), and tasks.md. `openspec validate --strict` still passes. Next: Pencil (task 0.2).
- 2026-08-21 — Frame done. Scaffolded via `/opsx:propose` after closing out the prerequisite
  `contact-log-axes` sync/archive (its `entrega`/`camino`/`resultado` model is the foundation
  this change narrows). Worktree fast-forward-merged the not-yet-merged
  `docs/sync-archive-contact-log-axes` branch so specs/design here reference the current
  main spec, not a stale pre-sync one. Design intentionally left 5 questions open rather than
  guessing defaults silently — flagged for the human gate per `/ps:ship` rules (design stage
  must not advance on the agent's own judgment).
- 2026-08-21 — Scope decision: no new campaign-trigger/suppression behavior from the in-call
  opt-out — stays consistent with the existing "OPT_OUT is recorded, not auto-enforced" stance
  (`campaign-triggers` spec, issue #101 gap). Not re-litigated here.
