# Ship checkpoint — agent-evaluations-console

Started: 2026-09-10
Current stage: 1 — Design (Pencil)

**Scope:** Bring agent evaluations into the webapp console: operators create/edit/delete
reusable `Scenario`s per `VOICE_AI`/`EMAIL`/`WHATSAPP` agent template, run one, and see a
persisted pass/fail `EvaluationRun` (per-turn results, tool calls, judge reasoning) in-app and
as a downloadable report. `SMS`/`VOICE_PRERECORDED` get a render-only preview tab, no
persistence. Everything nests as new tabs on the existing Agent Template detail page — not a
new top-level nav section — to keep the naturally data-heavy surface bounded.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes
(`mods/webapp/.storybook`) · E2E: yes (`playwright.config.ts`)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Scoped via 3 parallel Explore agents (webapp patterns, backend/Prisma patterns, Pencil frames) + 1 Plan agent; proposal/design/tasks/specs authored and `openspec validate --strict` passing.                                                                                                                                                                                                                                                                                    |
| 1   | Design (Pencil) | in-progress | All 9 `tasks.md` §1 sub-tasks structurally built overnight (frames `RrD1d`/`M21wq`/`qr1TI`/`OZ6rZ`/`ofDkU` in `pencil.pen`'s `uOaur`/`oZPkT` clusters, 2 new components, 1 hand-built tab-bar workaround — see decision log). **Not yet human-gated** — the user has not seen or approved these frames, and this session could not reliably self-verify visually. Do not advance to stage 2 until the user opens `pencil.pen` in Pen.app and explicitly says the design is good. |
| 2   | Spec reconcile  | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Build           | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Test            | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-09-11 — Design build finished for tonight: all 9 `tasks.md` §1 items structurally
  built and verified via the Pencil MCP's `Get`/bounds inspection (correct structure,
  positions, sizes — no zero/negative dimensions, no orphaned nodes). **Could not reliably
  visually confirm via `TakeScreenshot`** — it was flaky/inconsistent for freshly-created deep
  node trees all session (some frames rendered correctly on retry, others stayed blank across
  many retries despite verified-correct data; a couple improved only after several unrelated
  calls had passed). Treated as a renderer/cache staleness bug in the MCP tool itself, not a
  design defect, given `oK2Cr` (the most-edited, longest-"cooked" frame) and all pre-existing
  content rendered perfectly throughout. Sent product feedback; updated
  `reference_pencil_build_workaround` memory. **The user must open `pencil.pen` in Pen.app
  directly** (not rely on anything this session screenshotted) before judging the design.
- 2026-09-11 — Discovered the file's existing `Tabs`/`Tab Item` components (`yUASe`/`cwafo`/
  `DDw41`) are broken: every instance, in isolation or in context, rendered blank and failed
  bounds computation; confirmed via a document-wide search that they have zero prior usages
  anywhere in the file (never exercised before). Worked around by hand-building an equivalent
  pill tab bar from plain frames/text, visually matching the component's intended spec exactly
  (same tokens or shadow). Flagged in `tasks.md` 1.9 for the user to decide: fix the
  components, or deprecate them in favor of the hand-built pattern.
- 2026-09-10 — Design stage started: working `tasks.md` §1 frames/components in `pencil.pen`
  autonomously (overnight, per explicit user instruction to "go as far as designing with
  Pencil tonight" before checking in). Human gate for this stage is still owed — flag clearly
  when the user returns, do not treat overnight autonomous work as approval.
- 2026-09-10 — User decisions locked in via AskUserQuestion before autonomous work began:
  (1) persist scenarios + run history (new Prisma models, not ephemeral); (2) cover all 5
  agent-template channels — 3 conversational get full scenario/run treatment, SMS/VOICE_PRERECORDED
  get render-only preview only; (3) nest under Agent Template detail as tabs, not a new
  top-level nav section; (4) v1 ships both an in-app view and a downloadable report.
- 2026-09-10 — Proposal/design/tasks/specs authored in worktree
  `.claude/worktrees/agent-evaluations-console` (branch `worktree-agent-evaluations-console`),
  committed (`docs(openspec): propose agent-evaluations-console change`). `openspec validate
agent-evaluations-console --strict` passes.
- 2026-09-10 — Open question surfaced, deliberately left for the user (not auto-executed):
  whether to archive the still-unarchived `openspec/changes/agent-evaluations/` (SDK/apiserver
  engine, implementation-complete) before this change reaches Sync, so `agent-evaluations`
  exists as a real capability to declare a future delta against. See `design.md`'s Open
  Questions.
- 2026-09-10 — Checkpoint created; framing the change.
