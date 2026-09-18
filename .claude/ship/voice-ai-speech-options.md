# Ship checkpoint — voice-ai-speech-options

Started: 2026-09-17
Current stage: 6 — Archive (PR + merge pending)

**Scope:** VOICE_AI language options become `es-419` (default), `en`, `multi` (callers mix languages; syncs Deepgram `multi`, `nova-3` fallback); `es` dropped. Per-template `allowUserBargeIn` (default off) replaces the hard-coded `false`. On/off settings in agent forms become switches.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: yes · E2E: yes

Worktree: `.claude/worktrees/feat+voice-ai-stt-bargein` (branch `feat/voice-ai-stt-bargein`).

| #   | Stage           | Status      | Notes                                                               |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------ |
| 0   | Frame           | done        | Change written; mirrors voice-ai-idle-options                       |
| 1   | Design (Pencil) | done        | Switches; language label; prerecorded AMD gap closed                |
| 2   | Spec reconcile  | done        | Rewritten for language-based multi                                  |
| 3   | Build           | done        |                                                                     |
| 4   | Test            | done        | e2e in CI                                                           |
| 5   | Sync            | done        | Folded into specs/agent-templates/spec.md                           |
| 6   | Archive         | in-progress | Archived as 2026-09-18-voice-ai-speech-options; PR/CI/merge pending |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-09-17 — Pedro: no multilingual switch; offer `multi` as a language (VOICE_AI only, label says callers mix languages). Default Spanish `es-419` (Nova-3); drop `es`, no backwards compatibility, no data migration. Barge-in + switches kept. Pedro authorized PR, CI watch and merge.

- 2026-09-17 — Pedro: replace all form checkboxes with switches. Design: only form checkbox drawn was Crear agente · SMS GSM-7 (tAqkz) → switch. Code: GSM-7 + hangupOnMachineDetected → `Switch` (task 5.5). Campaign portfolio multi-select kept as checkboxes (list selection, not a setting); list filters and table row selection are not forms.

- 2026-09-17 — Pedro asked for switches instead of checkboxes: DS `Switch/Default`/`Switch/Checked` in the design, `components/ui/switch.tsx` in code. Multilingual label shortened to fit one line.

- 2026-09-17 — Design edited in the WORKTREE pencil.pen (opened as its own Pen.app editor) so main checkout's uncommitted website-v3 frames aren't touched. Uses DS `Checkbox/Default`/`Checkbox/Checked` with supporting text hidden (no hint lines per CLAUDE.md). Pen.app must save before committing (check mtime).

- 2026-09-17 — Settings live on the VOICE_AI template (like idle options), not workspace/campaign.
- 2026-09-17 — `multilingualStt` is a boolean beside `language`, not a `"multi"` language value: `language` also picks the TTS voice.
- 2026-09-17 — Multilingual with a non-multi deployment model falls back to `nova-3` rather than rejecting the save.
- 2026-09-17 — Checkpoint created; depends on fonoster/fonoster#910 only when multilingual is turned on.
