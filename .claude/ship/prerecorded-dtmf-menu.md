# Ship checkpoint — prerecorded-dtmf-menu

Started: 2026-08-21
Current stage: 4 — Test (done, except a live-Fonoster manual smoke test recommended before merge — see tasks.md 9.3)

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
**PR:** [#117](https://github.com/fonoster/qcobro/pull/117) (draft — not merge-ready, see
stage 4 blockers).

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change scaffolded via `/opsx:propose`: proposal, design (with 5 explicit open questions), 4 delta specs (agent-templates, prerecorded-audio, account-contact-log, web-console), tasks. `openspec validate --strict` passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1   | Design (Pencil) | done    | Open questions resolved by the user 2026-08-21 (maxRepeats 2, timeout 5s, repeat press sets `camino: ENGAGED` — extended to opt-out too, no default digits, scope = 2 screens). Pencil work done in `pencil.pen` (main checkout): added the DTMF section to `MnECY`/`cLzrm` ("Crear agente · Voz pregrabada"); added new block `AW2Op` ("Detalle de gestión — Pre-grabada · Opt-out"). Gestiones list needs no changes (already channel-generic).                                                                                                                                                                                                                                                                                  |
| 2   | Spec reconcile  | done    | No changes needed — the Pencil pass matched the drafted delta specs exactly (same 5 fields, same `camino`/`resultado` semantics). `openspec validate --strict` still passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Build           | done    | Full vertical slice across `mods/common` -> `mods/apiserver` -> `mods/webapp`. See tasks.md for the file-by-file breakdown. Notably: refactored `voiceServer.ts` to extract a testable `handlePrerecordedCall` (was previously 0%-covered); widened 3 separate dispatch call sites (manual outreach, campaign engine, `dispatchOutreachSchema`) to carry the DTMF metadata; hand-authored the Prisma migration SQL (no live DB in this worktree).                                                                                                                                                                                                                                                                                  |
| 4   | Test            | done    | Brought up the real local dev stack (Postgres/Identity/Mailpit via `compose.dev.yaml`, real apiserver, real webapp) and drove it with a real browser via Playwright. Migration rehearsal (2.2) done for real. New `e2e/prerecorded-dtmf-menu.spec.ts` (9.2) green, plus the full existing e2e suite (24/24) and both unit suites. This surfaced and fixed 2 real bugs mocked tests couldn't: a DB check constraint that still hard-blocked the DTMF menu, and a stray migration-drift table that hung `prisma migrate dev` on a fresh DB. Also fixed a hardcoded-English Cancel button. Only 9.3 (an actual live Fonoster call) remains -- flagged as a recommended manual smoke test before merge, not something to fake or skip. |
| 5   | Sync            | pending |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | Archive         | pending |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Open questions

None remain. All 5 resolved 2026-08-21 (see design.md § Design gate — resolved 2026-08-21).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-22 — User asked for `/code-review medium --fix` on the branch. 3 findings, all
  fixed: (1) real bug — Editar for VOICE_PRERECORDED only sent a DTMF field to the update
  patch when truthy, so clearing a previously-set digit/message and saving silently kept the
  old value; there was no way to disable a configured menu from the console. Now sends every
  field explicitly, including null. (2) Fixing that exposed a second real bug via the
  extended e2e test: the edit modal never invalidated `agentTemplates.get` after a save, so
  reopening Editar could show stale pre-save values. Invalidated it alongside `list`.
  (3) The webapp hand-rolled the same DTMF cross-field rules already in
  `voicePrerecordedDtmfSchema` (`@qcobro/common`) — now delegates to the shared schema and
  maps its Zod issues to the existing localized messages, which also picked up digit-format
  validation the hand-rolled version never had. Also fixed a stale design.md sentence
  (decision 6 still said Camino stays hidden for this channel). Extended
  `e2e/prerecorded-dtmf-menu.spec.ts` to cover the clear-field case. Full sweep green again:
  196/196 common, 450/450 apiserver, 24/24 e2e, lint+typecheck clean.

- 2026-08-22 — User asked to actually run the stack locally to see the UI. Brought up
  `compose.dev.yaml` (Postgres + Identity + Mailpit) in this worktree, copied local-dev-only
  `config/qcobro.json` and `config/identity/identity.json`+keys from the main checkout (all
  gitignored, dev-only credentials pointing at localhost services), ran migrations + seed,
  started apiserver (:3000) and webapp (:5173). User confirmed the UI visually. Filed issue
  #118 (placeholder/example text across console forms) as a follow-up from that review — out
  of scope for this PR, not actioned here.
  Then wrote `e2e/prerecorded-dtmf-menu.spec.ts` and ran it for real, which found two bugs
  unit tests structurally cannot catch (both mock Prisma): (1) `contact_log_axes`'s DB-level
  CHECK constraint `account_contact_logs_one_way_channel_check` still unconditionally blocked
  `VOICE_PRERECORDED` from ever having a non-null `camino`/`resultado` — the Zod-layer
  carve-out from stage 3 was never mirrored at the DB layer. Fixed via a new migration
  narrowing the constraint the same way. Diagnosed by writing a standalone repro script
  calling the real validated function against the real DB directly, since the REST endpoint
  swallows non-ValidationErrors into a generic 500. (2) Also hit and fixed an unrelated
  pre-existing migration-drift bug: `contact_log_axes` left a scratch table
  (`dnc_seed_from_intent_status`) with no `schema.prisma` model, which makes `prisma migrate
dev` hang forever on an interactive prompt on any genuinely fresh database (stdin has
  nothing to answer it in a non-interactive shell) — took several minutes to correctly
  diagnose as a hang-not-slow via `ps`/`pg_stat_activity`, not a bug in the DTMF work itself.
  Also fixed a pre-existing hardcoded-English "Cancel" button on both agent-template dialogs
  (found because it blocked the new e2e test) — narrowly scoped to the 2 Dialog calls in this
  PR's file; 8 other call sites elsewhere have the same gap, left alone as out of scope.
  Full sweep after all fixes: 196/196 common, 450/450 apiserver, 24/24 e2e (including the new
  spec), lint+typecheck clean. Declined to run `prisma migrate reset` to re-verify from a
  truly clean DB when Prisma's own AI-agent safety guard blocked it without explicit user
  consent — not necessary, since the fix was already verified via a direct repro plus the
  full e2e suite.

- 2026-08-21 — Build (stage 3) done, Test (stage 4) partially done. Implemented the full
  vertical slice; see tasks.md for the per-file breakdown. Key implementation calls made
  without a separate gate (small enough to just decide): (a) `repeatMessage`/`optOutMessage`
  are plain operator-authored strings, NOT Handlebars-rendered against the customer context
  like `script` is — these are fixed IVR prompts, not personalized copy; (b) on the repeat
  loop, only the script replays, not the menu announcement messages, to avoid re-reading the
  full menu on every repeat; (c) the update-path DTMF fields follow this file's existing
  can't-clear-once-set convention (`...(fields.x ? {x} : {})`), matching `senderId`/
  `maxReplies` rather than inventing a new clear-vs-omit distinction; (d) `voiceServer.ts` was
  refactored to extract `handlePrerecordedCall` as a directly-testable function — it had zero
  prior test coverage since `startVoiceServer` instantiates the whole embedded Fonoster
  server, and testing the new branch logic properly needed a seam. Full lint+typecheck+test
  sweep green (mods/common 196/196, mods/apiserver 450/450, mods/webapp typecheck+lint only —
  no unit runner exists in that package). Explicitly NOT done and NOT skippable before merge:
  Playwright e2e (9.2), a live-Fonoster dev-stack run (9.3), and a migration rehearsal against
  a real Postgres (2.2) — none were possible from this sandboxed session.
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
