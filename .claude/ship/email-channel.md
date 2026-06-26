# Ship checkpoint — email-channel

Started: 2026-06-26
Current stage: 5 → Sync (build + test done, all green) — awaiting sync gate

**Scope:** Add EMAIL as a real, bidirectional channel — outbound collection notices via
**Resend** plus an **inbound webhook** that brings replies back, correlated to the
originating gestión. The EMAIL agent becomes a VOICE_AI-style **autopilot**: a system
prompt decides the next action on each reply (reply / ignore / resolve), bounded by a
**max-emails-per-attempt** cap. Inbound replies are AI-analyzed to capture outcomes
(PAYMENT_PROMISE, etc.) + Objectives, like Voice AI.

**Detected surfaces:** OpenSpec ✓ · Pencil ✓ (`pencil.pen`) · Storybook ✓ (webapp) ·
E2E: nominal (dep only, no config/dir) · Webapp unit runner: none (apiserver/common use node:test)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                  |
| :-- | :-------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Surfaces + channel research done; this is a NEW change                                                                                                                                                                                                                                                                                                                                 |
| 1   | Design (Pencil) | done    | EMAIL agent modal (iKZY0): "Prompt del sistema (autopiloto)" + "Máximo de respuestas" (UKuyF/XhHO6). Email detail (Y8lQc): bidirectional thread (replyIn Ixonh / replyAgent DIjFZ) + Resultado "Promesa de pago" + "1 de 3" cap. User approved.                                                                                                                                        |
| 2   | Spec reconcile  | done    | design.md + email-channel/spec.md + 4 delta specs + tasks.md; `openspec validate --strict` passes                                                                                                                                                                                                                                                                                      |
| 3   | Build           | done    | **All groups 1–9 built.** Contracts; Prisma (2 migrations); agent persistence; Resend client+emulator+dispatch EMAIL branch; engine EMAIL channel+funnel; inbound webhook + `ingestEmailReply` autopilot (correlate→thread→decide→cap→reply→outcome); webapp (agent systemPrompt+cap, gestión thread, objectives); seed + README docs.                                                 |
| 4   | Test            | done    | Unit: dispatchOutreach EMAIL + ingestEmailReply (validation-failure incl). Integration: engine EMAIL dispatch + no_email + inbound capped autopilot + outcome capture. **109/109 apiserver tests; lint + typecheck (common/apiserver/webapp) green.** Sim confirms EMAIL autopilot campaign dispatches 6 with reply-to tokens. No webapp unit runner (n/a); no e2e harness configured. |
| 4   | Test            | pending |                                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | Sync            | pending |                                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | Archive         | pending |                                                                                                                                                                                                                                                                                                                                                                                        |

## Decisions (frame)

- **Provider: Resend** (send + inbound webhook). Postmark is the fallback if Resend
  inbound parsing/threading proves limiting.
- **Reply loop: AI autopilot.** Send notice → wait → on each inbound reply the agent's
  prompt decides next action (reply / ignore / resolve / escalate). **Cap the back-and-
  forth** with a max-emails-per-attempt limit (configurable) so a debtor can't keep the
  AI talking indefinitely; past the cap → stop replying (escalate/ignore).
- **Correlation/threading:** per-attempt reply-to token stored as the gestión `providerRef`
  (already added for campaigns-engine), plus honoring `References`/`In-Reply-To`.
- **Outcome capture:** reuse the AI-insight path (extract PAYMENT_PROMISE etc. + Objective)
  on inbound replies, like the voice-events hook.

## How channels stand (research)

- SMS / VOICE_PRERECORDED: one-way send. VOICE_AI: bidirectional via Fonoster autopilot +
  `POST /api/voice/events` → `ingestVoiceEvent` (correlate by callRef, store transcript,
  AI insight). EMAIL: valid `AgentType` + `EmailConfig` (subject/messageBody/fromName/
  fromEmail) but **no dispatcher** → engine reports `channel_not_supported`.
- Mirror VOICE_AI for EMAIL: outbound (Resend) + inbound webhook (`POST /api/email/inbound`)
  - thread correlation + AI agent decision + capped auto-reply.

## Deferred / linked

- Contact identity by email (`docs/design-notes/contact-identity.md`) — email strengthens
  the case for a person/contact entity (history by email), but stays deferred.
- `ai-insights` change (15/19) — email outcome capture reuses its LLM/insight infra.

## Decision log

- 2026-06-26 — Frame complete. Resend + AI autopilot with max-emails cap chosen. Creating
  the OpenSpec `email-channel` change next.
