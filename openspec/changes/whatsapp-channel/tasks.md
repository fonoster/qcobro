## 1. Compliance & onboarding docs (no code)

- [ ] 1.1 Document the Meta Business verification flow (Business Manager, phone registration, display-name review) on the QCobro site and in an internal runbook
- [ ] 1.2 Write the account-health playbook: quality-rating monitoring, opt-out handling, template-policy compliance, and number-ban escalation
- [ ] 1.3 Document the operator-side template-approval handoff (UTILITY category, named placeholders drawn from QCobro's documented variable set)

## 2. Contracts in @qcobro/common

- [x] 2.1 Add `WHATSAPP` to `DispatchChannel` and `dispatchChannelSchema`; add the WHATSAPP branch fields (templateName + the workspace-resolved `languageCode`) to `dispatchOutreachSchema`
- [x] 2.5 Update the `WHATSAPP` createAgentTemplate discriminant: opener body is **read-only/derived** (`templateId` + resolved `templateName` + fetched `messageBody`); add operator-authored `systemPrompt` and `maxReplies` (mirror the `EMAIL` discriminant — the agent is smart); do NOT add a `language` field. Add `defaultLanguage` to the WhatsApp integration schema (`upsertWhatsAppIntegration`) — workspace-level WhatsApp config kept together, not on `WorkspaceSettings`
- [x] 2.2 Add the `WhatsAppClient` port to `types/dispatch.ts`: `sendTemplate` (named params), `sendText` (free-form reply inside the 24h window), and `fetchTemplate(templateId)` for the modal preview; plus result types
- [x] 2.3 Add workspace-integration schemas/types: `WhatsAppIntegration` (wabaId, accessToken, verifyToken) and `WhatsAppSenderNumber` (phoneNumberId, displayNumber, label, qualityRating, capabilities) — no `languageDefault`
- [x] 2.4 Port the Meta webhook body schema from `../mikro/mods/common/src/schemas/whatsapp.ts`

## 3. Data model & secret storage

- [x] 3.1 Add Prisma models `WhatsAppIntegration` (per-workspace, unique workspaceRef) and `WhatsAppSenderNumber` (unique phoneNumberId), with the `Campaign.whatsAppSenderNumberId` nullable FK; extend `WhatsAppConfig` with `metaTemplateId`, `systemPrompt`, `maxReplies`; add `defaultLanguage` to `WhatsAppIntegration`
- [x] 3.2 Generate and apply the additive migration (no backfill)
- [x] 3.3 Add the cloak encryption key (`k1.aesgcm256.<base64>`) to `qcobro.json` Zod config + `qcobro.example.json`; absence disables the integration area rather than crashing boot
- [x] 3.4 Adopt `prisma-field-encryption` (Fonoster/Routr "cloak" pattern): mark `WhatsAppIntegration.accessToken` `/// @encrypted`, extend the PrismaClient with `fieldEncryptionExtension` conditionally on the key (Routr pattern); never log plaintext — no hand-rolled AES

## 4. Workspace Integrations area (server)

- [x] 4.1 Validated functions to create/read/update the workspace WhatsApp integration (token encrypted on write, never returned in plaintext)
- [x] 4.2 Validated functions to add/list/remove sender numbers, rejecting duplicate `phoneNumberId`
- [x] 4.3 tRPC procedures exposing the integrations area through the workspace-scoped context

## 5. Meta WhatsApp client & dispatch

- [x] 5.1 Implement `MetaWhatsAppClient` (port `../mikro/.../client/sendMessage.ts` `sendTemplateMessage`, named params) plus `sendText` (free-form) and `fetchTemplate(templateId)` via `GET /{wabaId}/message_templates` for the modal preview, with a send timeout and structured Meta-error surfacing
- [x] 5.2 Add an injectable emulator implementing `WhatsAppClient` for unit tests
- [x] 5.3 Add the `WHATSAPP` branch to `dispatchOutreach`: extract `{{tokens}}` from `messageBody`, render against context, send as named params, return `DispatchResult`; keep the function pure
- [x] 5.4 Resolve the `WhatsAppClient` per dispatch from the workspace integration + selected sender (decrypt token, build/cache client) in the engine and manual-outreach flows

## 6. Campaign sender selection & engine wiring

- [x] 6.1 Enforce at campaign create: `WHATSAPP` template requires a workspace-owned `whatsAppSenderNumberId`; non-WhatsApp templates carry none
- [x] 6.2 Wire the engine tick so WHATSAPP campaigns resolve their sender number and dispatch via the per-call client (funnel already requires a phone)

## 7. Inbound webhook, AI replies & opt-out

- [x] 7.1 Implement the Meta webhook route: verify-token handshake + signature verification, rejecting unverified requests
- [x] 7.2 Resolve inbound events to a workspace/sender by `phoneNumberId`; map block/opt-out to `IntentStatus.OPT_OUT`; update `qualityRating` from quality callbacks
- [ ] 7.3 On an inbound customer message, record it on the gestión and trigger the smart agent: reuse the email agent's AI-reply mechanism (`systemPrompt`), send the reply via `WhatsAppClient.sendText`, cap at `maxReplies`, and refuse free-form replies once Meta's 24h window has closed
- [ ] 7.4 Detect opt-out intent and payment-promise registration from the conversation (consistent with the email agent)

## 8. Web console

- [ ] 8.1 Build the Workspace Integrations settings area: connect WABA, manage sender numbers, and set the workspace template-send language (i18n strings, no hardcoded copy)
- [ ] 8.2 Add WhatsApp sender selection to campaign creation when the agent template is `WHATSAPP`
- [ ] 8.3 In the `WHATSAPP` agent-template modal: Meta **template-id** input + a **read-only** preview textarea populated by `WhatsAppClient.fetchTemplate`, plus editable **Prompt del sistema** + **Máximo de respuestas** fields (like the email modal); block creation when no workspace integration exists
- [ ] 8.4 Add the **Integraciones** entry to the avatar menu (`Comp/User Menu`), next to Miembros / Configuración del espacio, routing to the Integrations area
- [ ] 8.5 Render the WhatsApp gestión detail as a conversation thread (template opener → customer/agent replies → AI Insights → metadata)

## 9. Tests

- [x] 9.1 Unit tests for the WHATSAPP dispatch branch (named-param rendering, missing-integration error) with the emulator
- [x] 9.2 Unit tests for integration storage (token encrypted at rest, never returned; duplicate phoneNumberId rejected) and campaign sender-selection validation
- [x] 9.3 Tests for the inbound webhook (signature rejection, opt-out → suppression, quality-rating update)
- [ ] 9.4 Unit tests for the smart-agent reply path: reply generated within the window, `maxReplies` cap halts further replies, closed 24h window forbids free-form text, opt-out intent in conversation suppresses the account
- [ ] 9.5 e2e: create integration + sender → create WHATSAPP campaign → tick dispatches via the emulator and records a gestión with the Meta message id as providerRef
