# Docs checkpoint — agent-evaluations

Started: 2026-07-30
Current stage: 3 — Outline

**Purpose:** A developer integrating via `@qcobro/sdk` (or `@qcobro/ctl`, which wraps it)
wants to check how an agent will behave, or see what a static message renders to, before it
goes live. They leave knowing which method fits their channel, how to shape scenarios/turns,
and how to read the results.

**Diátaxis type:** how-to
**Reader:** developer already comfortable with basic SDK usage (has read sdk/overview,
sdk/authentication)

**Detected surfaces:** Mintlify: yes, `docs-site/` · Pencil: not used for this page ·
OpenSpec: yes, `openspec/changes/agent-evaluations/`

**Placement:** new page `docs-site/sdk/agent-evaluations.mdx` · slug `sdk/agent-evaluations`
· nav group "SDK", inserted after `sdk/sync-accounts`. Companion edits (not new pages):
`docs-site/cli/overview.mdx` ("Agentes" section — stale `agents:eval` disclaimer) and
`docs-site/sdk/reference.mdx` (add export rows).

**Sources:**

- `mods/sdk/src/resources/agentEvaluations.ts`, `mods/sdk/src/resources/agentTemplates.ts`
  (preview method), `mods/sdk/src/client.ts`
- `mods/common/src/schemas/agentEvaluations.ts`, `mods/common/src/types/agentEvaluations.ts`
- `openspec/changes/agent-evaluations/{proposal,design}.md`,
  `specs/agent-evaluations/spec.md`, `specs/sdk-agent-templates/spec.md`
- `mods/ctl/src/commands/agents/{eval,preview,sync}.ts`
- Existing pages for voice/style precedent: `docs-site/sdk/portfolios.mdx`,
  `docs-site/sdk/sync-accounts.mdx`, `docs-site/sdk/reference.mdx`,
  `docs-site/cli/overview.mdx`
- `docs-site/CLAUDE.md` (editorial policy — Spanish, no internal mechanism names, no
  em-dashes, realistic `WO...`/`AP...` example ids)

| #   | Stage   | Status  | Notes                                                                                                                                                                                               |
| :-- | :------ | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame   | done    | Gate confirmed by user                                                                                                                                                                              |
| 1   | Source  | done    | Read all files above                                                                                                                                                                                |
| 2   | Place   | done    | New how-to page + 2 companion edits, no new nav group                                                                                                                                               |
| 3   | Outline | done    | Gate confirmed by user                                                                                                                                                                              |
| 4   | Assets  | skipped | No diagram/screenshot warranted, code-first SDK how-to                                                                                                                                              |
| 5   | Draft   | done    | sdk/agent-evaluations.mdx + companion edits to cli/overview.mdx, sdk/reference.mdx                                                                                                                  |
| 6   | Proof   | done    | Manual accuracy pass against source; grepped for em-dashes/internal names (none); internal links verified against docs.json; `mintlify dev` not run (CLI install was slow/inconclusive in this env) |
| 7   | Wire    | done    | Added `sdk/agent-evaluations` to docs.json SDK group after sdk/sync-accounts                                                                                                                        |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-30 — Frame gated and confirmed: how-to page + 2 companion edits, no new nav group.
- 2026-07-30 — No existing docs page mentions "evaluate" at all, so no disambiguation needed
  against `engine-scorecard` in the public docs (internal-only concern).
- 2026-07-30 — Must describe VOICE_AI grading behaviorally ("QCobro compara la respuesta
  generada con la esperada"), never naming the underlying provider/mechanism, per editorial
  policy.
- 2026-07-30 — Checkpoint created; framing the page.
