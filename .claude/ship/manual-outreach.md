# Ship checkpoint — manual-outreach

Started: 2026-06-22
Current stage: 3 — Build (backend trigger layer; webapp modal awaits Pencil design)

**Focus:** The outreach **trigger layer** + a manual one-off path from a Cartera. Two
slices: (A) `channel-dispatch` — reusable, provider-injected dispatch functions (Fonoster
voice + Twilio SMS) with Handlebars templating + number rotation; the same primitive the
campaigns engine will call. (B) `web-console` — "Contactar manualmente" row action + modal
in the portfolio accounts view.

**Scope decisions:** Channels = VOICE_AI, VOICE_PRERECORDED (Fonoster `Calls`), SMS
(Twilio). EMAIL/WhatsApp dispatch + Twilio status webhooks + the campaigns engine deferred.
Dispatch fns are pure triggers (no DB); the manual procedure records a gestión via existing
`createContactLog` (outcome OTHER, manual notes).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: no · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                  |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Proposed + validated. Grounded in existing FonosterVoiceApplicationClient, config schema, createContactLog, PortfolioAccount/agent-template types.                                                                                                                                                                                                                     |
| 1   | Design (Pencil) | done    | APPROVED. Modal (zxxPQ) + Cartera detalle (F5CG54) ⋯ menu. Campaign required → agent/channel shown as note (agent derived from campaign); contextual preview (Primer mensaje for Voz IA). ⋯ standardized to the documented row-actions pattern (Acciones column + bordered ellipsis btn, like Campañas/Agentes lists).                                                 |
| 2   | Spec reconcile  | done    | web-console delta updated for campaign-required + agent-derived + channel-appropriate preview + standard ⋯. `openspec validate manual-outreach` → valid.                                                                                                                                                                                                               |
| 3   | Build           | done    | Backend (commit 56a4b9e) + design-driven changes: outreach.dispatch now takes {portfolioAccountId, campaignId} (campaign → agent). Webapp: ReachOutModal (campaign select, agent note, live Handlebars preview via @qcobro/common) + ⋯ row action in PortfolioDetail + en/es i18n. Voices→fonoster, TTS-per-voice, VoiceServer for pre-recorded. typecheck+lint green. |
| 4   | Test            | done    | Unit: common 10/10, apiserver 62/62. E2E: manual-outreach.spec.ts passes (portfolio→SMS agent→campaign→CSV import→⋯ Contactar manualmente→campaign select→agent note + rendered preview). All 3 channels also live-verified via smoke tests.                                                                                                                           |
| 5   | Sync            | pending | Gated.                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Archive         | pending | Gated.                                                                                                                                                                                                                                                                                                                                                                 |

## Decision log

- 2026-06-22 — LIVE smoke tests passed (scripts/smoke-dispatch.ts, TEMPORARY): Voz IA call
  to +17853178070 rang (Fonoster ref 35d4eec6…); SMS delivered via Twilio (SID SM900c07…).
  Both through the real dispatchOutreach path with Handlebars personalization. Pre-recorded
  still needs a pre-recorded Fonoster app (sync not built — deferred).
- 2026-06-22 — Config tweaks (commit 1f2438b): moved voices under `fonoster.voices`; removed
  `autopilot.ttsProductRef`, now derived per voice via `ttsProductRefForVoice` → `tts.<provider>`
  (shared Voz IA + pre-recorded). Normalized qcobro.json voice providers to bare names.
- 2026-06-22 — Backend trigger layer shipped (commit 56a4b9e): channel-dispatch capability
  fully built + unit-tested + pushed. Next: human-gated Pencil modal design → webapp → e2e.
- 2026-06-22 — Proposed manual-outreach (split from campaigns-core dispatch deferral).
  Capabilities: channel-dispatch (new) + web-console (modified). Handlebars chosen for
  templating. Building backend trigger layer before the (human-gated) Pencil modal design.
