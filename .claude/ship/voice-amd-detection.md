# Ship checkpoint — voice-amd-detection

Started: 2026-09-12
Current stage: 3 — Build

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

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                         |
| :-- | :-------------- | :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | OpenSpec change `voice-amd-detection` created; proposal/design/specs/tasks all complete and `openspec validate --strict` passes. Working in worktree `feat/voice-amd-detection`.                                                                                                                                                                                              |
| 1   | Design (Pencil) | done        | Added the hang-up-on-machine checkbox to "Crear agente · Voz pregrabada" (`MnECY`), matching the `normalizeGsm7` pattern (default checked, via `vetmI` Checkbox/Checked ref). No existing mock of a `VOICEMAIL`/machine-detected scenario to update; no separate prerecorded edit-modal mock exists. User approved, "keep going with the next phase."                         |
| 2   | Spec reconcile  | done        | Design added nothing beyond what the delta specs already documented (the default-checked toggle came from the spec, not the other way around) — no spec/tasks changes needed. `openspec validate --strict` still passes.                                                                                                                                                      |
| 3   | Build           | in-progress | tasks.md §1–4 and §6 done (schema/migration applied to local dev DB, common schemas, apiserver plumbing incl. sweep-path labeling, webapp checkbox+i18n rename). §5 (dependency bump) stays gated — re-checked npm, still unreleased. All work built against local type augmentations so the gate doesn't block anything else. Commits: `8cf9305` (code), `6cc5b90` (Pencil). |
| 4   | Test            | pending     |                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                                                                                                                                                               |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

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
