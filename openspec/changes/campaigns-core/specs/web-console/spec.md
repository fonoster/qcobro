## ADDED Requirements

### Requirement: Campaign list page

The operator console SHALL have a "Campañas" page accessible from the sidebar. It
SHALL display all campaigns for the active workspace (excluding ARCHIVED by default)
in a sortable table. Each row SHALL show: name, portfolios (count), agent template
name, schedule (start – end or "sin fecha límite"), status badge, and a row-actions
menu (⋯).

#### Scenario: Default view excludes ARCHIVED campaigns

- **WHEN** the operator navigates to the Campañas page
- **THEN** campaigns with status ARCHIVED are not shown
- **AND** a filter control allows filtering by status

#### Scenario: Row-actions menu offers contextual actions

- **WHEN** the operator clicks ⋯ on a campaign row
- **THEN** a dropdown appears with: Ver detalle, Editar, and Eliminar (destructive)
- **AND** if the campaign is DRAFT or PAUSED, an "Activar" option appears
- **AND** if the campaign is ACTIVE, a "Pausar" option appears instead

### Requirement: Create campaign modal

The "Nueva campaña" button opens a modal collecting:

- Campaign name (required)
- Portfolio selection: multi-select from workspace portfolios (at least one required)
- Agent template: single select from workspace agent templates (shows name + type badge)
- Start date (required), end date (optional, must be after start date)
- Start time and end time (both required, HH:MM 24h)
- Max attempts per account (required), max attempts per day (required)

#### Scenario: Campaign created in DRAFT

- **WHEN** an operator submits the create form with valid inputs
- **THEN** the campaign appears in the list with status DRAFT
- **AND** the modal closes

### Requirement: Campaign detail page

Each campaign SHALL have a detail page with:

- Header: name, status badge, agent template name + channel type, schedule
- KPI strip: total accounts targeted, total gestiones, objectives created,
  fulfilment rate
- Associated portfolios card (name, account count per portfolio)
- Trigger configuration summary (list of configured triggers)
- Recent gestiones table (last 50, paginated): account name, result badge, agent,
  amount, contacted at

#### Scenario: Recent gestiones table links to gestión detail

- **WHEN** an operator clicks a row in the gestiones table on the campaign detail page
- **THEN** the gestión detail panel or page opens for that interaction

### Requirement: Agent Templates section

The operator console SHALL have an "Agentes" page in the sidebar showing all agent
templates for the workspace. The list table SHALL show: name, type badge, collection
strategy, status, performance KPIs (total calls, total objectives, recovery rate),
and row actions (Ver detalle, Editar, Eliminar).

The detail page SHALL show: template header with KPI strip (total calls,
gestiones/execution, objectives 30D, objective rate — mirroring the old Agentes IA
KPI strip), type-specific config summary, and a list of campaigns using this template.

#### Scenario: Agent template list shows performance KPIs

- **WHEN** an operator views the Agentes page
- **THEN** each row shows the agent template's cumulative performance counters
  (totalCalls, totalPromises mapped to total objectives, successRate)

### Requirement: Gestiones section

The operator console SHALL have a "Gestiones" page in the sidebar showing all
gestiones (outreach interactions) across the workspace. The list table SHALL show:
deudor (account name), resultado (outcome badge), agente (agent template name), monto
(debtAmountSnapshot), fecha (contactedAt), and row actions.

#### Scenario: Gestiones list is filterable

- **WHEN** an operator views the Gestiones page
- **THEN** filter controls allow filtering by: outcome, agent template, portfolio,
  campaign, and date range

#### Scenario: Gestión detail shows transcript and AI analysis

- **WHEN** an operator opens a gestión detail view
- **THEN** if the channel is voice, an audio player is shown at the top
- **AND** if `channelData.transcriptText` is present, the transcript is shown as a
  conversation (agent vs account holder messages)
- **AND** the AI analysis section shows: aiSummary, aiSentiment badge, aiDebtReason,
  aiResult, and aiNextStep
- **AND** any Objectives linked to this gestión are shown below the AI analysis
- **AND** a metadata card shows: duration, language, agent template, account number,
  outstanding balance, phone number

### Requirement: Objetivos section

The operator console SHALL have an "Objetivos" page in the sidebar tracking all
Objectives across the workspace. This replaces and generalises the old
"Promesas de Pago" section from the prior design.

The list table SHALL show: account name, objective type badge, amount (if applicable),
due date, days until/past due, status badge, and row actions.

KPI strip SHALL show: total pending objectives, total amount pending (for monetary
objectives), objectives due this week, fulfilment rate (MET / total closed).

#### Scenario: Overdue objectives highlighted

- **WHEN** an Objective's `dueDate` has passed and `status` is still `PENDING`
- **THEN** the row is highlighted and status shown as `VENCIDO`
- **AND** the days-past-due counter is shown in red

#### Scenario: Objective status can be updated by operator

- **WHEN** an operator marks an Objective as MET or CANCELLED
- **THEN** `Objective.status` is updated accordingly
- **AND** for MET monetary objectives, the amount feeds into portfolio `recoveredAmount`
  (aggregation deferred to a future change)
