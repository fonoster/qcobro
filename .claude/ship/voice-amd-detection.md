# Ship checkpoint — voice-amd-detection

Started: 2026-09-12
Current stage: DONE — all six stages complete

**Scope:** Activate Fonoster's Asterisk-based answering-machine detection (AMD, PR #893)
in QCobro: rename `Path.VOICEMAIL` → `ANSWERED_BY_MACHINE`; add a per-template
`hangupOnMachineDetected` toggle (default on) so pre-recorded campaigns hang up in real
time on a detected machine; label `path: ANSWERED_BY_MACHINE` from the CDR's `amdStatus`
in the voice completion sweep for both channels (Voz IA's live conversation path is
explicitly out of scope — documented limitation, separate follow-up issue for Fonoster).
Dependency bump + build/runtime verification are gated on Fonoster actually shipping a
release containing PR #893 (confirmed still unreleased as of 2026-09-12).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes
(`mods/webapp/.storybook`) · E2E: yes (`playwright.config.ts` + `e2e/`)

| #   | Stage           | Status             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :-- | :-------------- | :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done               | OpenSpec change `voice-amd-detection` created; proposal/design/specs/tasks all complete and `openspec validate --strict` passes. Working in worktree `feat/voice-amd-detection`.                                                                                                                                                                                                                                                                                                                                  |
| 1   | Design (Pencil) | done               | Added the hang-up-on-machine checkbox to "Crear agente · Voz pregrabada" (`MnECY`), matching the `normalizeGsm7` pattern (default checked, via `vetmI` Checkbox/Checked ref). No existing mock of a `VOICEMAIL`/machine-detected scenario to update; no separate prerecorded edit-modal mock exists. User approved, "keep going with the next phase."                                                                                                                                                             |
| 2   | Spec reconcile  | done               | Design added nothing beyond what the delta specs already documented (the default-checked toggle came from the spec, not the other way around) — no spec/tasks changes needed. `openspec validate --strict` still passes.                                                                                                                                                                                                                                                                                          |
| 3   | Build           | done (§5 deferred) | tasks.md §1–4 and §6 done (schema/migration applied to local dev DB, common schemas, apiserver plumbing incl. sweep-path labeling, webapp checkbox+i18n rename). §5 (dependency bump) is the one genuinely-blocked item — re-checked npm right before this stage closed, still unreleased — everything else was built against local type augmentations precisely so this gate blocks nothing else. Commits: `8cf9305` (code), `6cc5b90` (Pencil).                                                                 |
| 4   | Test            | done               | 12 new unit tests (voiceServer ×5, voiceCompletionTimeoutSweep ×4, recordVoiceAiCallStatus ×2, recordPrerecordedOutcome ×1) — full apiserver suite 567/567, mods/common 271/271, all green; tsc + eslint clean across common/apiserver/webapp. E2E: extended `prerecorded-dtmf-menu.spec.ts` with the toggle + machine-detected-gestión rendering; verified with `playwright test --list` (compiles) but **not run end-to-end** — no dev stack (webapp/apiserver) was started in this sandbox. Commit: `c08e7e3`. |
| 5   | Sync            | done               | User approved "sync + archive now." Promoted delta specs into `account-contact-log`, `agent-templates`, `prerecorded-audio`; `openspec validate --all --strict` clean for all three (one pre-existing, unrelated failure on `change/money-workspace-locale`). Closed #83, filed #180. Commits: `150c531`, `d73ce3a`.                                                                                                                                                                                              |
| 6   | Archive         | done               | Moved to `openspec/changes/archive/2026-09-11-voice-amd-detection/`. Commit: `a43223c`.                                                                                                                                                                                                                                                                                                                                                                                                                           |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-09-12 — Sync + Archive complete, per user approval ("sync + archive now, leave
  §5/e2e as follow-up"). Closed #83 (commented with a summary), filed #180 for the Voz
  IA real-time follow-up. Synced delta specs into account-contact-log, agent-templates,
  prerecorded-audio (`d73ce3a`); archived the change to
  `openspec/changes/archive/2026-09-11-voice-amd-detection/` (`a43223c`). Ship complete —
  four tasks remain as deliberate, disclosed follow-up (§5 dependency bump blocked
  upstream; §8.1 needs a live dev-stack run). Branch not yet pushed or PR'd — that's the
  next thing to decide with the user.
- 2026-09-12 — Build + Test stages complete (commits `8cf9305`, `c08e7e3`). §5 (the
  `@fonoster/voice`/`@fonoster/sdk` bump) stays open/blocked — re-confirmed still
  unpublished — everything else is done and green. E2E extended but not run live (no dev
  stack in this sandbox); flagged for a real run before merge. Stopping at the Sync gate
  for explicit approval before promoting the delta specs into `openspec/specs/**`.
- 2026-09-12 — Design: added the checkbox to the pre-recorded create modal only (no
  mocked scenario existed for the path-label rename, no edit-modal mock exists to update
  in parallel). Committed to the worktree branch (`6cc5b90`) after copying the live
  pencil.pen from the main checkout, since Pen.app writes there regardless of which
  worktree is active — that file may also carry other in-progress design work that was
  already pending in main before this change started. Awaiting explicit user approval of
  the design before continuing.
- 2026-09-12 — Frame complete: OpenSpec artifacts (proposal/design/specs/tasks) written
  and committed on `worktree-feat+voice-amd-detection`; `openspec validate --strict`
  passes. Entering stage 1 (Design/Pencil).
- 2026-09-12 — Confirmed via CI-log investigation that PR #893 is merged to
  `fonoster/fonoster` main but has NOT shipped in any release yet (v0.22.14 is an
  unrelated bugfix release) — corrects an earlier assumption in this session that it had
  released. Design/spec work proceeds regardless; dependency bump/build stays gated.
  User decision: keep going with design + spec now, don't wait or vendor a git dependency.
- 2026-09-12 — User decisions locked in during planning: collapse VOICEMAIL/IVR into one
  `ANSWERED_BY_MACHINE` value; pre-recorded gets a default-on hang-up toggle; Voz IA gets
  AMD too but only via the CDR/sweep path (not the live conversation path — Fonoster
  doesn't expose AMD to the Autopilot's own decision loop yet); file a separate follow-up
  issue for that gap instead of chasing it here.
- 2026-09-12 — Checkpoint created; framing the change.
