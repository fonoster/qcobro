## Context

Portfolios and accounts exist in QCobro but there is no mechanism to initiate or
schedule outreach. The campaign engine will live in this repo (deferred to a future
change, likely `mods/engine`) and will share the same Prisma schema and
`@qcobro/common` types — no external contract to protect, just a temporal boundary.

This design defines the data model the engine will operate against and the operator
console UI for managing agent templates and campaigns.

Key constraints:

- Engine is deferred but in-repo: schema decisions here are refactorable, not locked.
- Campaigns are multilingual: `PortfolioAccount.preferredLanguage` is the per-account
  signal; agent templates carry a default language.
- Only one agent template per campaign (one channel type per campaign).
- WhatsApp is modeled now but disabled in the UI — enabled when integration is ready.
- SMS, Email, and WhatsApp mechanics (sending) live in this repo. Voice calls
  (VOICE_PRERECORDED and VOICE_AI) are dispatched to an external Fonoster service via
  API; the engine triggers the call and receives a callback with the outcome.

## Goals / Non-Goals

**Goals**

- Define all Prisma models: `AgentTemplate` + five type-specific child tables,
  `Campaign`, `CampaignPortfolio`, `CampaignAccountState`, `CampaignTrigger`,
  `AccountContactLog`
- Provide tRPC procedures for agent template CRUD and campaign CRUD
- Deliver operator console screens: agent templates and campaigns
- Model both static and AI-detected triggers with a typed contract

**Non-Goals**

- Implement the outreach engine (`mods/engine` — future change)
- Implement SMS, Email, or WhatsApp sending
- Implement the Fonoster API call / callback handler for voice
- Implement the "Gestiones" reporting feature
- Real-time campaign progress streaming

## Decisions

### D1: Engine is deferred but in-repo — no external contract

The engine will live at `mods/engine` (or similar) in this repo and share the Prisma
client directly. There is no API boundary between the engine and the database — it
reads `Campaign`, `CampaignAccountState`, and `CampaignTrigger` directly.

**Implication**: trigger evaluation logic does not need to be exposed via tRPC. The
engine queries the DB. The API server only writes contact log entries and updates
hot-path fields — the engine reads its own state.

### D2: AgentTemplate uses base + child tables (Option A)

One `AgentTemplate` base table holds identity (`id`, `workspaceRef`, `name`, `type`,
timestamps). Five child tables hold type-specific fields — one row per template:

| Child table              | AgentType           |
| ------------------------ | ------------------- |
| `VoiceAiConfig`          | `VOICE_AI`          |
| `VoicePrerecordedConfig` | `VOICE_PRERECORDED` |
| `SmsConfig`              | `SMS`               |
| `EmailConfig`            | `EMAIL`             |
| `WhatsAppConfig`         | `WHATSAPP`          |

`Campaign` links to `AgentTemplate.id` — one FK, always clean. Type-specific fields
are never mixed in the same table.

**Alternative considered**: Single table with nullable columns per type.  
**Rejected**: User explicitly ruled out mixed-field tables for different agent types.

**Alternative considered**: Separate tables with no shared base, multiple nullable FKs
on Campaign.  
**Rejected**: Campaign would need 5 nullable FKs with a check constraint; every query
must determine which FK is populated.

### D3: Two-layer suppression — global hard vs campaign-local soft

- **Global** (on `PortfolioAccount`): `suppressUntil`, `intentStatus` — set for
  outcomes that should block the account across _all_ campaigns: OPT_OUT, WRONG_NUMBER,
  INTENT_MET. Cleared only by an explicit operator action.
- **Campaign-local** (on `CampaignAccountState`): `suppressUntil` — set for outcomes
  that are relevant to one campaign only: payment promise, callback requested. The
  account remains contactable by other concurrent campaigns.

### D4: CampaignAccountState tracks per-campaign attempt counts

`CampaignAccountState` is the engine's eligibility table. It holds `attemptCount`
(lifetime attempts for this account under this campaign) and `attemptsToday` (reset at
midnight by the engine). The engine can filter eligible accounts in a single join:

```sql
WHERE cas.attemptCount < c.maxAttemptsPerAccount
  AND cas.attemptsToday < c.maxAttemptsPerDay
  AND (cas.suppressUntil IS NULL OR cas.suppressUntil < NOW())
  AND (pa.suppressUntil IS NULL OR pa.suppressUntil < NOW())
  AND pa.intentStatus IS NULL
```

**Alternative**: Derive counts from `AccountContactLog` at query time.  
**Rejected for the hot path**: Contact log will grow large; a full scan per eligibility
check is expensive. Denormalized counts are written atomically by the API server when
a contact log entry is created.

### D5: Voice campaigns use agentRef — config pushed to Fonoster, not stored here

`VoiceAiConfig` and `VoicePrerecordedConfig` store the fields authored here (name,
voice, system prompt, script/first message, language). When an operator saves a voice
template, the system writes the Fonoster application via Fonoster API and stores the
returned `fonosterAppRef`. The engine triggers a call by passing `fonosterAppRef` +
the account's phone number. Fonoster's internal execution details are opaque to us.

The callback from Fonoster writes an `AccountContactLog` entry via the REST contact-log
endpoint (see D7).

### D6: Schedule as date + HH:MM strings; timezone from config

`startDate` / `endDate` are `DateTime` (date semantics). `startTime` / `endTime` are
`String` in `HH:MM` 24h format. These wall-clock times are interpreted in a single
deployment-wide timezone read from `qcobro.json` (`apiserver.timezone`, an IANA zone,
default `America/Costa_Rica`). Per-workspace timezones are deferred — for now one zone
per deployment keeps it simple and there is no local `Workspace` table to hang it on
(workspaces live in Fonoster Identity).

**Alternative**: Full `DateTime` pairs.  
**Rejected**: Campaigns repeat daily within a window; two time strings express that
intent more clearly than timestamp pairs.

### D7: External contact-log ingress — REST endpoint, workspace-scoped Basic auth

The operator console writes gestiones via tRPC, but external callers (the Fonoster
voice service's callback) are not tRPC clients. The API server exposes
`POST /api/contact-logs` accepting the same payload and running the same hot-path
updates and Objective creation as the tRPC procedure.

Authentication is **HTTP Basic, scoped to one workspace** — the credential authorizes
writes for exactly one workspace, matching the tenancy boundary used everywhere else.

**Alternative considered**: Per-campaign credentials.  
**Rejected**: management overhead (issue/rotate per campaign, Fonoster must track which
credential per campaign) with no isolation benefit — campaigns inside a workspace
already share the boundary and the engine is first-party.

**Alternative considered**: One global shared secret.  
**Rejected**: a single leak exposes every tenant; throws away tenant isolation.

Enforcement is gated by `apiserver.contactLogAuth.enabled` (off in local dev). The
credential storage/derivation mechanism is left to the engine/integration change; this
change fixes only the scope (workspace) and scheme (Basic).

## Data Model Summary

```
AgentTemplate (id, workspaceRef, name, type, createdAt, updatedAt)
  ├── VoiceAiConfig          (templateId, fonosterAppName, fonosterAppRef?, voice, systemPrompt, firstMessage, language)
  ├── VoicePrerecordedConfig (templateId, fonosterAppName, fonosterAppRef?, voice, script, firstMessage, language)
  ├── SmsConfig              (templateId, messageBody, senderId?)
  ├── EmailConfig            (templateId, subject, messageBody, fromName, fromEmail)
  └── WhatsAppConfig         (templateId, templateName, messageBody)

Campaign (id, workspaceRef, name, agentTemplateId, status, startDate, endDate?,
          startTime, endTime, maxAttemptsPerAccount, maxAttemptsPerDay,
          createdAt, updatedAt)
  ├── CampaignPortfolio      (campaignId, portfolioId)   [join — many-to-many]
  ├── CampaignTrigger        (id, campaignId, type, config Json)
  └── CampaignAccountState   (campaignId, portfolioAccountId, attemptCount,
                               attemptsToday, lastAttemptAt?, suppressUntil?)

AccountContactLog (id, portfolioAccountId, campaignId?, agentType, contactedAt,
                   durationSeconds?, outcome, intentMetadata Json?,
                   correctedEntryId?, createdAt)

PortfolioAccount  [existing — gains]
  lastContactedAt DateTime?
  suppressUntil   DateTime?
  intentStatus    IntentStatus?  -- enum: INTENT_MET | WRONG_NUMBER | OPT_OUT
  totalAttempts   Int @default(0)
```

## Risks / Trade-offs

- **Fonoster sync on template save** → If Fonoster is unavailable when an operator
  saves a voice template, `fonosterAppRef` won't be populated and the engine cannot
  dispatch. Mitigation: store templates locally regardless; show sync status in the UI;
  engine skips campaigns with unsynced voice templates.
- **Contact log volume** → Composite index on `(portfolioAccountId, createdAt)`;
  retention policy deferred.
- **`attemptsToday` drift** → Engine resets this field at midnight; a crashed engine
  may leave stale counts. Mitigation: engine on restart recalculates from log for the
  current calendar day. Deferred to engine implementation.
- **suppressUntil race** → Two engine workers dispatching the same account concurrently.
  Mitigation: advisory lock or optimistic CAS in engine. Deferred to engine implementation.

## Migration Plan

All migrations are additive. Rollback reverts app deployments; no data migration needed.

1. Apply SQL migrations: new enums, new tables, four new nullable columns on
   `PortfolioAccount`
2. Run `prisma generate`
3. Deploy apiserver with new routers
4. Deploy webapp with new pages
5. Engine: no deploy until `mods/engine` is implemented

## Open Questions

- **Timezone**: Resolved — single deployment-wide IANA zone in `qcobro.json`
  (`apiserver.timezone`). Per-workspace timezones deferred to a workspace-region change.
- **Fonoster callback auth**: Resolved at the design level — `POST /api/contact-logs`
  with workspace-scoped HTTP Basic auth, gated by `apiserver.contactLogAuth.enabled`
  (see D7). The exact credential storage/derivation is deferred to the
  engine/integration change.
- **Campaign cloning**: Deferred to follow-up change.
- **WhatsApp gating**: Tied to provider credential check. Deferred.
