# Ship checkpoint — gestiones

Started: 2026-06-23
Current stage: 5 — Sync (gate)

**Scope:** Operator console gets the **Gestiones** (outreach history: list + Detalle de
gestión) and **Objetivos** (KPI strip + table, replaces Promesas de Pago) sections, plus
sidebar nav (Agentes, Campañas, Gestiones, Objetivos) and Application Flow sections. The
Detalle de gestión is **channel-aware** across three channels — Pre-recorded, SMS, Voz IA.
**Expanded beyond the original proposal:** a new **apiserver Voz IA webhook** ingests the
Fonoster autopilot `CONVERSATION_ENDED` event (transcript + recording + AI analysis) into a
gestión. SMS/Pre-recorded are one-way (no callback); their AI insight reflects that.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (active `pencil.pen`, reference `pencil-old.pen`) · Storybook: yes · E2E: yes (Playwright)

| #   | Stage           | Status      | Notes                                                                                                                         |
| :-- | :-------------- | :---------- | :---------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Scope expanded to include Voz IA webhook (user-approved).                                                                     |
| 1   | Design (Pencil) | done        | 6 blocks built + approved: Gestiones list, 4 channel detail panels, Objetivos. Partial-blocks + notes approach.               |
| 2   | Spec reconcile  | done        | Narrowed to Gestiones (list + channel-aware detail), SMS first; Objetivos/webhook/sidebar-Objetivos deferred. openspec valid. |
| 3   | Build           | done        | SMS slice: list refined (Canal + Resumen IA, monochrome); channel-aware detail w/ SMS branch; persist SMS body; i18n en+es.   |
| 4   | Test            | done        | New e2e `gestiones-sms.spec.ts` passing; unit 65 pass; lint + typecheck green.                                                |
| 5   | Sync            | in-progress | GATE — awaiting approval to promote delta into main specs.                                                                    |
| 6   | Archive         | pending     | Hold: change stays open for the remaining channels (Pre-grabada, Email, Voz IA + webhook) and Objetivos.                      |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Key references

- **Webhook shape:** Fonoster autopilot `sendConversationEndedEvent.ts` — POST `CONVERSATION_ENDED`
  with `{ eventType, appRef, callRef, phone, chatHistory: Record<string,string>[], recordingUrl? }`.
- **Existing ingestion:** `mods/apiserver/src/rest/contactLogs.ts` (`POST /api/contact-logs`,
  optional workspace Basic auth) + `functions/campaigns/createContactLog.ts`.
- **Contact-log schema / AI fields:** `mods/common/src/schemas/contactLog.ts` (aiSummary,
  aiSentiment, aiDebtReason, aiResult, aiNextStep, intentMetadata, channelData).
- **Channel dispatch layer:** `mods/apiserver/src/functions/outreach/` (dispatchOutreach).

## Design decisions (Stage 1)

- **Detalle de gestión = slide-over panel** over the dimmed Gestiones list
  (modal-over-dashboard pattern), not a full page.
- **One detail panel per channel** — Voz IA, SMS, Pre-grabada — reusing common parts
  (shell, AI-analysis section, objective callout, metadata grid).
- **Voz IA** panel: audio player + transcript bubbles + full AI analysis + linked
  objectives + metadata (webhook-fed).
- **SMS / Pre-grabada** panels: ONE-WAY — no player/transcript. Show sent message (SMS) /
  played script (Pre-grabada) + delivery status + an AI insight that states the channel is
  one-way with no customer response captured + metadata.
- Build target is `pencil.pen` (rebuild file); `pencil-old.pen` is reference only.
- Channels in scope: Voz IA, SMS, Pre-grabada. **No Email** (old file had it; out of scope).

## Blockers

- **2026-06-23 — Pencil inspection tooling broken for this doc (RESOLVED via approach
  change).** `batch_get`/`snapshot_layout`/`export_nodes` ignore node scope and return the
  whole 158-node doc, truncating with children collapsed — so cloning+editing and blind
  component-internal overrides are impossible. **Resolution:** author content fresh (every
  created node returns its id) and build **partial content blocks** + an implementation
  note, rather than full screens. Verified authored frames + text + the `KIQZZ` sidebar ref
  render correctly (no "+50px blank-frame" bug). Sidebar "Objetivos" item can't be added by
  blind edit → captured as an implementation note instead of a Pencil edit.

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-23 — Pre-grabada + Email channels done: channel-aware one-way detail (player+guion
  for pre-grabada, email card for email), generic per-channel AI insight via i18n (no LLM,
  the agreed money-saving approach), shared `lib/channelIcon`. e2e covers all 3 one-way
  channels. AI-insight decision: generic for one-way; real LLM deferred to Voz IA (generate
  once at ingestion, or lazy-on-open+cache). Remaining: Voz IA + webhook, Objetivos.
- 2026-06-23 — SMS detail corrected to honor the design note: rendered as a **slide-over
  side panel** over the dimmed Gestiones list (new `ui/slide-over.tsx`; `GestionDetail`
  split into reusable `GestionDetailContent` + thin route wrapper). e2e updated to assert
  the panel (role=dialog), no URL change. Green.
- 2026-06-23 — SMS detail restyled to match the Pencil panel (card, emerald bubble + ticks,
  violet Análisis IA, Detalles grid) after feedback that it still used old UI; table stays
  monochrome (table-only color drop), detail keeps color.

- 2026-06-23 — Pencil inspection tooling blocker surfaced; design build paused pending
  user direction. Recon complete (clusters, sidebar, references all screenshotted).
- 2026-06-23 — Design format decided (slide-over panel; one panel per channel). Need
  Pencil switched to `pencil.pen` to build.
- 2026-06-23 — Stage 0 done → Stage 1. User approved expanding `gestiones` to include the
  Voz IA webhook ingestion (apiserver). Sequencing: one-way channels first, Voz IA after.
  Webhook unauthenticated for now with a loud "FIX AUTH SOON" note.
- 2026-06-23 — Checkpoint created; framing the change.
