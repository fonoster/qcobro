## 1. Database — Enums & Migrations

- [x] 1.1 Add enums to `schema.prisma`: `AgentType` (SMS, VOICE_PRERECORDED, VOICE_AI, EMAIL, WHATSAPP), `CampaignStatus` (DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED), `TriggerType` (MAX_ATTEMPTS_PER_DAY, DNC_CHECK, WRONG_NUMBER, OPT_OUT, PAYMENT_PROMISE, INTENT_MET, CALLBACK_REQUESTED), `ContactOutcome` (NO_ANSWER, PAYMENT_PROMISE, CALLBACK_REQUESTED, RESOLVED, PAID, WRONG_NUMBER, OPT_OUT, OTHER), `IntentStatus` (INTENT_MET, WRONG_NUMBER, OPT_OUT)
- [x] 1.2 Add `AgentTemplate` base model + five child models: `VoiceAiConfig`, `VoicePrerecordedConfig`, `SmsConfig`, `EmailConfig`, `WhatsAppConfig`
- [x] 1.3 Add `Campaign` model: id, workspaceRef, name, agentTemplateId (FK), status, startDate, endDate?, startTime, endTime, maxAttemptsPerAccount, maxAttemptsPerDay, createdAt, updatedAt
- [x] 1.4 Add `CampaignPortfolio` join model: @@id([campaignId, portfolioId])
- [x] 1.5 Add `CampaignTrigger` model: id, campaignId, type (TriggerType), config (Json)
- [x] 1.6 Add `CampaignAccountState` model: @@id([campaignId, portfolioAccountId]), attemptCount, attemptsToday, lastAttemptAt?, suppressUntil?
- [x] 1.7 Add `AccountContactLog` model: id, portfolioAccountId, campaignId?, agentType, contactedAt, durationSeconds?, outcome, notes?, debtAmountSnapshot?, aiSummary?, aiSentiment?, aiDebtReason?, aiResult?, aiNextStep?, intentMetadata Json?, channelData Json?, correctedEntryId?, createdAt; composite index on (portfolioAccountId, createdAt)
- [x] 1.8 Add `Objective` model: id, contactLogId (FK→AccountContactLog), portfolioAccountId (denormalized), type (ObjectiveType enum: PAYMENT_PROMISE|PARTIAL_PAYMENT|CALLBACK_SCHEDULED|INFORMATION_REQUEST|DISPUTE_RAISED|OTHER), amount Float?, dueDate, status (ObjectiveStatus enum: PENDING|MET|BROKEN|CANCELLED), notes?, createdAt, updatedAt; index on (portfolioAccountId, dueDate)
- [x] 1.9 Add `collectionStrategy`, `totalCalls`, `totalPromises`, `totalRecovered`, `successRate` to `AgentTemplate` base model
- [x] 1.10 Add four new fields to `PortfolioAccount`: lastContactedAt DateTime?, suppressUntil DateTime?, intentStatus IntentStatus? (Prisma enum from 1.1), totalAttempts Int @default(0)
- [x] 1.11 Write hand-authored SQL migration for all new tables/enums/columns
- [x] 1.12 Run `prisma generate` to update client types

## 2. Common — Schemas & Types

- [x] 2.1 Create `mods/common/src/schemas/agentTemplates.ts`: `createAgentTemplateSchema` (name, type, type-specific config via discriminated union), `updateAgentTemplateSchema` (mutable fields, type excluded), `deleteAgentTemplateSchema`
- [x] 2.2 Create `mods/common/src/schemas/campaigns.ts`: `createCampaignSchema` (name, agentTemplateId, portfolioIds min(1), startDate, endDate?, startTime, endTime, maxAttemptsPerAccount, maxAttemptsPerDay), `updateCampaignSchema` (agentTemplateId excluded), `deleteCampaignSchema`
- [x] 2.3 Create `mods/common/src/schemas/contactLog.ts`: `createContactLogSchema` (portfolioAccountId, campaignId?, agentType, contactedAt, durationSeconds?, outcome, notes?, debtAmountSnapshot?, aiSummary?, aiSentiment?, aiDebtReason?, aiResult?, aiNextStep?, intentMetadata?, channelData?); `updateObjectiveSchema` (id, status)
- [x] 2.4 Create `mods/common/src/types/agentTemplates.ts`: `AgentTemplateRecord`, `VoiceAiConfigRecord`, `VoicePrerecordedConfigRecord`, `SmsConfigRecord`, `EmailConfigRecord`, `WhatsAppConfigRecord`, `AgentTemplateClient` interface
- [x] 2.5 Create `mods/common/src/types/campaigns.ts`: `CampaignRecord`, `CampaignTriggerRecord`, `CampaignAccountStateRecord`, `AccountContactLogRecord`, `ObjectiveRecord`, `CampaignClient` interface
- [x] 2.6 Export all new schemas and types from index files
- [x] 2.7 Extend `qcobroConfigSchema`: add `apiserver.timezone` (IANA zone string, default `America/Costa_Rica`) and `apiserver.contactLogAuth.enabled` (boolean, default false); update `qcobro.json` and the `qcobro-prod.json` example
- [x] 2.8 Build common: `npm run build -w mods/common`

## 3. API Server — Validated Functions

- [x] 3.1 Create `createAgentTemplate.ts`: creates base + child config row in a transaction; validates type-specific required fields
- [x] 3.2 Create `updateAgentTemplate.ts`: rejects type changes with ValidationError; updates base + child fields
- [x] 3.3 Create `deleteAgentTemplate.ts`: rejects deletion if template is referenced by any non-ARCHIVED campaign
- [x] 3.4 Create `createCampaign.ts`: creates Campaign + CampaignPortfolio rows in a transaction; validates agentTemplateId belongs to same workspace
- [x] 3.5 Create `updateCampaign.ts`: rejects agentTemplateId changes; validates endDate > startDate
- [x] 3.6 Create `deleteCampaign.ts`: only allows deletion of DRAFT campaigns
- [x] 3.7 Create `createContactLog.ts`: writes log entry; creates linked `Objective` if outcome is PAYMENT_PROMISE or PARTIAL_PAYMENT_AGREED (using intentMetadata.promisedAmount + promisedDate); atomically updates PortfolioAccount (lastContactedAt, totalAttempts++; global intentStatus on RESOLVED/PAID/WRONG_NUMBER/OPT_OUT); updates CampaignAccountState (attemptCount++, attemptsToday++, campaign-local suppressUntil to promisedDate or fallback); increments AgentTemplate.totalCalls and totalPromises

## 4. API Server — tRPC Routers

- [x] 4.1 Create `mods/apiserver/src/trpc/routers/agentTemplates.ts`: `list`, `get`, `create`, `update`, `delete` procedures (workspace-scoped)
- [x] 4.2 Create `mods/apiserver/src/trpc/routers/campaigns.ts`: `list` (excludes ARCHIVED by default), `get`, `create`, `update`, `delete`, `contactLog.create` procedures
- [x] 4.3 Register both routers in `mods/apiserver/src/trpc/index.ts`
- [x] 4.4 Add REST route `POST /api/contact-logs` in `mods/apiserver/src/index.ts`: workspace-scoped HTTP Basic auth middleware (gated by `config.apiserver.contactLogAuth.enabled`; rejects payloads referencing a different workspace than the credential); reuses `createContactLog` so it shares hot-path updates and Objective creation with the tRPC path

## 5. API Server — Unit Tests

- [x] 5.1 Unit test `createAgentTemplate`: creates base + child row; rejects unknown type; validates type-specific required fields
- [x] 5.2 Unit test `updateAgentTemplate`: rejects type change; accepts other field updates
- [x] 5.3 Unit test `createCampaign`: validates portfolioIds min(1); rejects cross-workspace template; rejects endDate before startDate
- [x] 5.4 Unit test `updateCampaign`: rejects agentTemplateId change
- [x] 5.5 Unit test `createContactLog`: updates lastContactedAt always; sets campaign-local CampaignAccountState.suppressUntil on PAYMENT_PROMISE (leaves global PortfolioAccount.suppressUntil untouched); sets intentStatus on RESOLVED/PAID/WRONG_NUMBER/OPT_OUT; increments CampaignAccountState counts
- [x] 5.6 Unit test `POST /api/contact-logs` auth: accepts valid workspace credentials; rejects missing/invalid credentials with 401 when enabled; rejects payloads referencing a different workspace; bypasses auth when `contactLogAuth.enabled` is false

## 6. Webapp — i18n Keys

- [x] 6.1 Add agent template keys to `en` and `es`: section title, type labels, field labels, sync status labels
- [x] 6.2 Add campaign keys: page title, status labels, column headers, form labels, action labels, WhatsApp "próximamente" label

## 7. Webapp — Agent Templates Pages

- [x] 7.1 Create `mods/webapp/src/pages/AgentTemplates.tsx`: list page with DataTable, type FilterSelect, "Nuevo agente" button, RowActionsMenu (Ver detalle, Editar, Eliminar)
- [x] 7.2 Create `CreateAgentTemplateModal` inside `AgentTemplates.tsx`: name, type selector; type-specific fields rendered conditionally; WhatsApp shown disabled
- [x] 7.3 Create `mods/webapp/src/pages/AgentTemplateDetail.tsx`: template header, config summary card, sync status for voice templates, list of campaigns using this template
- [x] 7.4 Add `/agent-templates` and `/agent-templates/:id` routes to `App.tsx`
- [x] 7.5 Add "Agentes" sidebar nav item to `AuthedLayout`

## 8. Webapp — Campaign Pages

- [x] 8.1 Create `mods/webapp/src/pages/Campaigns.tsx`: list page with DataTable, status FilterSelect, "Nueva campaña" button, RowActionsMenu (Ver detalle, Editar, Activar/Pausar, Eliminar)
- [x] 8.2 Create `CreateCampaignModal` inside `Campaigns.tsx`: name, portfolio multi-select, agent template selector, start/end date, start/end time, maxAttemptsPerAccount, maxAttemptsPerDay
- [x] 8.3 Create `mods/webapp/src/pages/CampaignDetail.tsx`: campaign header KPI strip, portfolios card, trigger config summary, gestiones table (last 50 paginated; account name, resultado badge, agente, monto, fecha)
- [x] 8.4 Add `/campaigns` and `/campaigns/:id` routes to `App.tsx`
- [x] 8.5 Add "Campañas" sidebar nav item to `AuthedLayout`

## 9. Webapp — Gestiones & Objetivos Pages

- [x] 9.1 Create `mods/webapp/src/pages/Gestiones.tsx`: workspace-wide gestión list; columns: deudor, resultado badge, agente, monto, fecha; filterable by outcome/agent/portfolio/campaign/date range
- [x] 9.2 Create `mods/webapp/src/pages/GestionDetail.tsx`: audio player (voice), transcript as conversation bubbles, AI analysis section (summary, sentiment badge, debt reason, result, next step), linked Objectives, metadata card (duration, language, agent, account no, balance, phone)
- [x] 9.3 Create `mods/webapp/src/pages/Objetivos.tsx`: workspace-wide objectives list; KPI strip (pending count, pending amount, due this week, fulfilment rate); columns: cuenta, tipo badge, monto, fecha límite, días restantes/vencidos, estado; VENCIDO highlight for overdue
- [x] 9.4 Add `/gestiones`, `/gestiones/:id`, `/objetivos` routes to `App.tsx`
- [x] 9.5 Add "Gestiones" and "Objetivos" sidebar nav items to `AuthedLayout`

## 10. Pencil — Design

- [x] 10.1 Design agent template list screen (table + KPI strip + "Nuevo agente" button)
- [ ] 10.2 Design "Nuevo agente" modal (type selector + conditional type-specific fields)
- [ ] 10.3 Design agent template detail screen (config summary + sync status badge for voice + campaigns list)
- [ ] 10.4 Add `CAMPAÑAS`, `GESTIONES`, `OBJETIVOS` flow sections to Application Flow
- [ ] 10.5 Design campaign list screen (table with status filter + "Nueva campaña" button)
- [ ] 10.6 Design "Nueva campaña" modal (all form fields)
- [ ] 10.7 Design campaign detail screen (header KPIs, portfolios card, gestiones table)
- [ ] 10.8 Design Gestiones list screen (referencing old Gestiones screen from pencil-old.pen)
- [ ] 10.9 Design Detalle de gestión screen (audio player, transcript, AI analysis, objectives — referencing old Detalle de gestión screen from pencil-old.pen)
- [ ] 10.10 Design Objetivos list screen (KPI strip + table; replaces old "Promesas de Pago" screen from pencil-old.pen)
- [ ] 10.11 Update sidebar to include "Agentes", "Campañas", "Gestiones", "Objetivos" nav items

## 11. E2E Tests (Playwright)

- [x] 11.1 Write e2e test: create a VOICE_AI agent template, verify it appears in list
- [x] 11.2 Write e2e test: create a DRAFT campaign referencing the template, verify it appears in list
- [x] 11.3 Write e2e test: activate a campaign, verify status badge changes
- [x] 11.4 Write e2e test: navigate to campaign detail page, verify portfolio and schedule info
