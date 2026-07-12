# Ship checkpoint — prerecorded-deliverability

Started: 2026-07-12
Current stage: DONE — archived

**Scope:** Reframe `VOICE_PRERECORDED` from fire-and-forget to an Observed channel — `DELIVERED`
= call answered (drop "Reproducido"), with `durationSeconds` as the honest signal. The co-located
VoiceServer settles usage and writes the gestión **in-process** (no HTTP callback), reusing the
voice estimate→settle path. Gestión detail gains an arrow-driven lifecycle stepper; email/WhatsApp
are un-mislabeled as "one-way" and render their thread.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (playwright.config.ts)

| #   | Stage           | Status               | Notes                                                                                                                                                                                                                                                                                  |
| :-- | :-------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done                 | Change scaffolded + all 4 artifacts written; `openspec validate` passes                                                                                                                                                                                                                |
| 1   | Design (Pencil) | done                 | Signed off. Lifecycle merged into "Estado de entrega" field as reached-stage arrow string; even columns; pre-recorded reframed; email/WhatsApp render threads                                                                                                                          |
| 2   | Spec reconcile  | done                 | web-console delta reworded to "Estado de entrega" progression + single-cycle cap; validate passes                                                                                                                                                                                      |
| 3   | Build           | done (answered path) | backend: `prerecordedCompletionSchema`, `recordPrerecordedOutcome`, VoiceServer duration+completion, index record+settle wiring. webapp: Estado-de-entrega arrow progression for all channels, "Guion reproducible", honest copy, EN/ES stage labels. Open: unanswered-path (task 3.5) |
| 4   | Test            | done                 | Unit 5✓ (answered/unanswered/idempotent/validation); common 102✓, apiserver 46✓, webapp typecheck, eslint all green. E2E updated but NOT run (needs live dev stack)                                                                                                                    |
| 5   | Sync            | done                 | 4 deltas promoted into main specs (account-contact-log, prerecorded-audio, usage-ledger, web-console); `openspec validate --all` 40/40 pass                                                                                                                                            |
| 6   | Archive         | done                 | Moved to openspec/changes/archive/2026-07-12-prerecorded-deliverability                                                                                                                                                                                                                |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-12 — Build+Test: backend (common schema, recordPrerecordedOutcome +5 tests, VoiceServer completion, index settle wiring) + webapp (Estado-de-entrega arrow progression, honest pre-recorded copy, EN/ES stage labels). All touched packages green (common 102, apiserver 46, webapp typecheck, eslint). E2E updated, not executed (needs live stack). OPEN: unanswered-path detection needs Fonoster call-status (task 3.5) — the embedded verb only fires on answer. Awaiting decision before Stage 5 (sync, gated).

- 2026-07-12 — Design final: merged lifecycle into the existing "Estado de entrega" metadata field as a unicode-arrow string of reached stages (e.g. "Enviado → Entregado"); deleted the duplicate single-value status item on SMS/Email/WhatsApp; even columns, even top. Stage-2 spec impact: reword web-console delta from "arrow-driven stepper component" to "Estado de entrega delivery-status field renders the reached-stage progression".
- 2026-07-12 — Design simplified per feedback ("too much"): removed the pill stepper from all 5 blocks; lifecycle first tried as a standalone "Recorrido" metadata line (unicode arrow). Pre-grabada copy fixes retained.
- 2026-07-12 — Design pass: arrow lifecycle stepper added to all 5 gestión-detail blocks (SMS, Pre-grabada, Voz IA, Email, WhatsApp). Pre-grabada reframed: stepper Enviado→Entregado·0:38, "Guion reproducible" (script separated), AI copy no longer claims message was heard, Resultado Reproducido→Entregado. Confirmed email/WhatsApp blocks already render message threads (validates the web-console "one-way" mislabel fix). Gate answers: roll out to all 4; keep "Enviado" verb for voice.
- 2026-07-12 — Frame done → entering Design. Change `prerecorded-deliverability` created; deltas for account-contact-log, prerecorded-audio, usage-ledger, web-console; validate passes.
- 2026-07-12 — Decision: pre-recorded completion is **in-process** (co-located VoiceServer), no HTTP callback (differs from Voz IA).
- 2026-07-12 — Decision: drop "Reproducido"; `DELIVERED` = answered; answered duration is the reporting/billing signal.
- 2026-07-12 — Decision: label "Entregado" (unified with SMS); enum stays DELIVERED/NOT_DELIVERED (display-only, revisitable at design gate).
- 2026-07-12 — Decision: bundle the web-console email/WhatsApp thread fix into this change.
- 2026-07-12 — Findings source: DELIVERABILITY.md at repo root.
