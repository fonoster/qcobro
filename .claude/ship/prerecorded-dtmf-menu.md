# Ship checkpoint — prerecorded-dtmf-menu

Started: 2026-08-21
Current stage: 0 — Frame (artifacts scaffolded, awaiting design gate)

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

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                       |
| :-- | :-------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change scaffolded via `/opsx:propose`: proposal, design (with 5 explicit open questions), 4 delta specs (agent-templates, prerecorded-audio, account-contact-log, web-console), tasks. `openspec validate --strict` passes. |
| 1   | Design (Pencil) | pending | Human gate. Open questions in design.md need answers before Pencil work starts (task 0.1 in tasks.md).                                                                                                                      |
| 2   | Spec reconcile  | pending |                                                                                                                                                                                                                             |
| 3   | Build           | pending |                                                                                                                                                                                                                             |
| 4   | Test            | pending |                                                                                                                                                                                                                             |
| 5   | Sync            | pending |                                                                                                                                                                                                                             |
| 6   | Archive         | pending |                                                                                                                                                                                                                             |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Open questions (must resolve before/at Design gate)

See design.md § Open Questions for full context:

1. Default digits to pre-fill in the config form (repeat `1`, opt-out `9`? or blank)
2. `maxRepeats` default — 2 (design leans this) or 3
3. Gather timeout — proposing 5s
4. Does a repeat press ever set `camino`? Design leans no (v1: repeat is silent on the axes,
   only `channelData.repeatCount` records it)
5. Pencil scope confirmation — pre-recorded template config form + Gestión detail/Gestiones
   list only, or other screens too?

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-21 — Frame done. Scaffolded via `/opsx:propose` after closing out the prerequisite
  `contact-log-axes` sync/archive (its `entrega`/`camino`/`resultado` model is the foundation
  this change narrows). Worktree fast-forward-merged the not-yet-merged
  `docs/sync-archive-contact-log-axes` branch so specs/design here reference the _current_
  main spec, not a stale pre-sync one. Design intentionally left 5 questions open rather than
  guessing defaults silently — flagged for the human gate per `/ps:ship` rules (design stage
  must not advance on the agent's own judgment).
- 2026-08-21 — Scope decision: `resultado: OPT_OUT` only for the opt-out digit; a repeat press
  sets neither `camino` nor `resultado` in v1 (only `channelData.repeatCount`), to avoid
  inventing a `camino` meaning for a one-way IVR keypress that doesn't map cleanly onto the
  ENGAGED/ABANDONED/VOICEMAIL enum built for conversational channels. Reversible later without
  a schema change. Flagged as open question 4 for confirmation, not treated as locked.
- 2026-08-21 — Scope decision: no new campaign-trigger/suppression behavior from the in-call
  opt-out — stays consistent with the existing "OPT_OUT is recorded, not auto-enforced" stance
  (`campaign-triggers` spec, issue #101 gap). Not re-litigated here.
