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

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                                 |
| :-- | :-------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Proposed + validated. Grounded in existing FonosterVoiceApplicationClient, config schema, createContactLog, PortfolioAccount/agent-template types.                                                                                                                    |
| 1   | Design (Pencil) | in-progress | Applies to the web-console modal slice only (backend has no UI). Human-gated — to do with user.                                                                                                                                                                       |
| 2   | Spec reconcile  | done        | channel-dispatch + web-console deltas authored at propose time. `openspec validate manual-outreach` → valid. Re-check after Pencil design.                                                                                                                            |
| 3   | Build           | in-progress | Backend slice DONE + pushed (commit 56a4b9e): config (fonoster.numbers + twilio), ports, dispatch schema, Handlebars templating, Fonoster/Twilio adapters, dispatchOutreach fn, context wiring, outreach.dispatch procedure. Webapp modal slice awaits Pencil design. |
| 4   | Test            | in-progress | Unit DONE: common 8/8 (templating), apiserver 61/61 (+6 dispatch: SMS/voice happy, validation-fail, unconfigured, empty-pool). lint+typecheck green. E2E (SMS golden path) pending webapp.                                                                            |
| 5   | Sync            | pending     | Gated.                                                                                                                                                                                                                                                                |
| 6   | Archive         | pending     | Gated.                                                                                                                                                                                                                                                                |

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
