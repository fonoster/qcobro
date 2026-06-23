## Why

QCobro's value is not just storing debt portfolios — it is _running_ AI-voice collection
campaigns over them. Without campaigns, the platform has no way to initiate contact,
schedule outreach windows, or apply the intelligent suppression rules that make
multilingual AI collections compliant and effective. This change introduces the core
campaign data model, the agent template system, and the management UI so the internal
engine (deferred, but living in this repo) has a well-defined contract to operate against.

## What Changes

- New `AgentTemplate` entity (first-class, own section in the console): reusable agent
  configuration for each channel type; base identity table + per-type child tables
  (VoiceAiConfig, VoicePrerecordedConfig, SmsConfig, EmailConfig, WhatsAppConfig)
- New `Campaign` entity: links one or more portfolios to a scheduled outreach program
  with a reference to an AgentTemplate; includes lifetime and daily attempt caps
- Campaign scheduling: mandatory start date, optional end date, mandatory daily outreach
  window (start time / end time in HH:MM)
- Campaign status lifecycle: DRAFT → ACTIVE → PAUSED → COMPLETED → ARCHIVED
- New `CampaignAccountState` entity: per-campaign, per-account attempt counters and
  campaign-local suppression; the engine's hot-path eligibility table
- **Static contact triggers**: per-campaign suppression rules (max attempts per day,
  DNC list check, wrong-number flag, opt-out)
- **AI contact triggers**: intent-aware suppression — payment promise suppresses until
  promise date; resolved/paid sets permanent INTENT_MET status
- New `AccountContactLog` (Gestión) entity: records every outreach attempt with
  AI insight fields (summary, sentiment, debt reason, result, next step), call
  transcript reference, channel metadata, and linked Objectives
- New `Objective` entity: actionable outcome of a gestión (payment promise, partial
  payment, callback, dispute, etc.); generalizes the concept of "payment promises";
  has its own status lifecycle (PENDING → MET | BROKEN | CANCELLED) and feeds the
  Objectives section of the console
- Web console screens: agent template list + detail, campaign list, campaign detail,
  create/edit modals; "Campañas" and "Agentes" sidebar entries
- Two-layer suppression: global hard suppression on `PortfolioAccount` (OPT_OUT,
  WRONG_NUMBER, INTENT_MET — blocks all campaigns); campaign-local soft suppression
  on `CampaignAccountState` (payment promise, callback — blocks one campaign only)

## Capabilities

### New Capabilities

- `agent-templates`: AgentTemplate CRUD with per-type child config tables; first-class
  section in the operator console
- `campaigns`: Campaign CRUD — create, list, get, update status, delete; references an
  AgentTemplate and associates portfolios; defines schedule and attempt caps
- `campaign-triggers`: Static and AI trigger rules stored per campaign; evaluated by
  the engine before each outreach attempt
- `account-contact-log`: Per-account gestión log (outreach history) with AI insight
  fields, transcript metadata, and linked Objectives; foundation for trigger evaluation
  and the Gestiones section of the operator console

### Modified Capabilities

- `portfolio-accounts`: Add `lastContactedAt`, `suppressUntil`, `intentStatus`, and
  `totalAttempts` for global hot-path suppression and lifetime attempt tracking
- `web-console`: Add Agent Templates section and Campaigns section to the operator
  console; add both to the sidebar

## Impact

- **Prisma schema**: New models `AgentTemplate`, `VoiceAiConfig`, `VoicePrerecordedConfig`,
  `SmsConfig`, `EmailConfig`, `WhatsAppConfig`, `Campaign`, `CampaignPortfolio`,
  `CampaignAccountState`, `CampaignTrigger`, `AccountContactLog`, `Objective`; new enums
  `AgentType`, `CampaignStatus`, `TriggerType`, `ContactOutcome`, `ObjectiveType`,
  `ObjectiveStatus`, `IntentStatus`; `PortfolioAccount` gains four new fields
- **`@qcobro/common`**: New schemas and types for all new entities
- **`mods/apiserver`**: New `agentTemplates` and `campaigns` tRPC routers; new validated
  functions; contact log procedures; a REST `POST /api/contact-logs` endpoint with
  workspace-scoped HTTP Basic auth (config-gated) for the external Fonoster callback
- **`qcobro.json` config**: New `apiserver.timezone` (IANA zone, deployment-wide) and
  `apiserver.contactLogAuth.enabled` flag
- **`mods/webapp`**: New pages `AgentTemplates`, `AgentTemplateDetail`, `Campaigns`,
  `CampaignDetail`; updated `AuthedLayout` sidebar; new i18n keys
- **Engine (deferred)**: Lives in this repo (`mods/engine` or `mods/worker`); not
  implemented in this change but shares the same Prisma schema and `@qcobro/common` types
