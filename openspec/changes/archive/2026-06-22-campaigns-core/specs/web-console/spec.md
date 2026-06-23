## ADDED Requirements

### Requirement: Campaign list page

The operator console SHALL have a "Campañas" page accessible from the sidebar. It
SHALL display all campaigns for the active workspace (excluding ARCHIVED by default)
in a sortable table. Each row SHALL show: name, agent template name, portfolios (count),
days of week (a human-readable, localized label such as "Entre semana" or "Lun a Vie"),
daily time window (`startTime`–`endTime`), status badge, and a row-actions menu (⋯).

#### Scenario: Default view excludes ARCHIVED campaigns

- **WHEN** the operator navigates to the Campañas page
- **THEN** campaigns with status ARCHIVED are not shown
- **AND** a filter control allows filtering by status

#### Scenario: Row-actions menu offers contextual actions

- **WHEN** the operator clicks ⋯ on a campaign row
- **THEN** a dropdown appears with: Ver detalle, Editar, and Eliminar (destructive)
- **AND** if the campaign is PAUSED, an "Activar" option appears
- **AND** if the campaign is ACTIVE, a "Pausar" option appears instead

### Requirement: Create campaign modal

The "Nueva campaña" button SHALL open a modal collecting:

- Campaign name (required)
- Portfolio selection: multi-select from workspace portfolios (at least one required)
- Agent template: single select from workspace agent templates (shows name + type badge)
- Start date (required), end date (optional, must be after start date)
- Days of week (required, at least one): presented as seven individually selectable
  toggles (L M X J V S D) so any combination — e.g. Monday and Friday only — is possible
- Start time and end time (both required, HH:MM 24h)
- Max attempts per account (required), max attempts per day (required)

#### Scenario: Campaign created in PAUSED

- **WHEN** an operator submits the create form with valid inputs
- **THEN** the campaign appears in the list with status PAUSED
- **AND** the modal closes

### Requirement: Campaign detail page

Each campaign SHALL have a read-only detail page that shows the same configuration captured
at creation — no analytics or KPI strip. It SHALL include:

- Header: name, status badge, and status-change controls (a primary Activar/Pausar action
  plus an overflow menu offering Completar and Archivar)
- Campaign detail card: agent template (name + channel type), associated portfolios, days of
  week (human-readable), daily time window, start/end dates, and attempt caps
- Trigger configuration summary (list of configured triggers)

#### Scenario: Operator changes campaign status from the detail page

- **WHEN** an operator uses the status control on a campaign's detail page to activate or
  pause it
- **THEN** the new status is saved and reflected in the status badge
- **AND** only transitions valid for the current status are offered

### Requirement: Agent Templates section

The operator console SHALL have an "Agentes" page in the sidebar showing all agent
templates for the workspace. The list table SHALL show: name, type (channel) badge,
creation date, and row actions (Ver detalle, Editar, Archivar/Restaurar, Eliminar).
The list SHALL NOT show a collection-strategy column, a status column, or performance
KPIs; archived templates are revealed by a "Mostrar archivados" toggle. The page
header SHALL surface example template variables and a documentation link.

The detail page SHALL show: the template header with its channel badge (and a
synchronization indicator for voice templates), a type-specific configuration summary,
and a list of campaigns using this template. The detail page SHALL NOT show a KPI strip.

#### Scenario: Agent template list shows channel and creation date

- **WHEN** an operator views the Agentes page
- **THEN** each row shows the template name, its channel badge, and its creation date —
  with no collection-strategy or performance-counter columns

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
