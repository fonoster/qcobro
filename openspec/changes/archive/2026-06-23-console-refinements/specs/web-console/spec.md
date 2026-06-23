## ADDED Requirements

### Requirement: Panel de control reads live workspace data

The Panel de control (home) SHALL source its activity and per-cartera widgets, and the
"Cuentas en gestión" KPI, from live workspace data rather than mock constants.

- "Gestiones recientes" SHALL list the most recent recorded outreach attempts
  (`AccountContactLog`) for the active workspace, each showing the account/customer
  identity, a human-readable outcome, and a relative timestamp.
- "Progreso por cartera" SHALL list the workspace's active carteras. Because no
  recovery-progress metric exists yet, each cartera's progress SHALL be a simulated value
  between 10% and 80%, derived deterministically from the cartera so it is stable across
  renders.
- The "Cuentas en gestión" KPI SHALL show the total number of accounts under management,
  computed as the sum of the active carteras' account counts.

#### Scenario: Recent gestiones reflect real attempts

- **WHEN** an operator opens the Panel de control
- **THEN** "Gestiones recientes" shows real recent contact-log entries for the workspace
- **AND** when there are no recorded attempts, the widget shows an empty state rather than
  mock rows

#### Scenario: Per-cartera progress is simulated within bounds

- **WHEN** the "Progreso por cartera" widget renders an active cartera
- **THEN** its progress value is between 10% and 80%
- **AND** the same cartera shows the same value across renders

## MODIFIED Requirements

### Requirement: Agent Templates section

The operator console SHALL have an "Agentes" page in the sidebar showing all agent
templates for the workspace. The list table SHALL show: name (with an archived badge on
archived templates), type (channel) badge, and row actions (Ver detalle, Editar,
Archivar/Restaurar, Eliminar). The list SHALL NOT show a creation-date column, a
collection-strategy column, a status column, or performance KPIs; archived templates are
revealed by a "Mostrar archivados" toggle. The page header SHALL surface example template
variables and a documentation link.

The detail page SHALL show: the template header with its channel badge, a type-specific
configuration summary, and a list of campaigns using this template. The detail page SHALL
NOT show a KPI strip. A synchronization indicator and a manual re-sync action SHALL be
shown ONLY for `VOICE_AI` templates (which sync to Fonoster); `VOICE_PRERECORDED` and the
text channels are managed locally and SHALL NOT show any sync indicator or action. In the
configuration summary, the agent's language SHALL be shown as its human-friendly label
(e.g. "Español"), not the raw language code.

#### Scenario: Agent template list shows channel without creation date

- **WHEN** an operator views the Agentes page
- **THEN** each row shows the template name and its channel badge — with no creation-date,
  collection-strategy, or performance-counter columns
- **AND** archived templates show an archived badge next to the name

#### Scenario: Sync indicator appears only for VOICE_AI

- **WHEN** an operator opens the detail page of a non-`VOICE_AI` template
  (`VOICE_PRERECORDED`, `SMS`, `EMAIL`, or `WHATSAPP`)
- **THEN** no synchronization indicator or re-sync action is shown
- **AND** for a `VOICE_AI` template, the synchronization indicator and re-sync action are shown

### Requirement: Campaign list page

The operator console SHALL have a "Campañas" page accessible from the sidebar. It
SHALL display all campaigns for the active workspace (excluding ARCHIVED by default)
in a sortable table. Each row SHALL show: name, agent template name, days of week (a
human-readable, localized label such as "Entre semana" or "Lun a Vie"), daily time
window (`startTime`–`endTime`), status badge, and a row-actions menu (⋯). The list
SHALL NOT show a creation-date column.

#### Scenario: Default view excludes ARCHIVED campaigns

- **WHEN** the operator navigates to the Campañas page
- **THEN** campaigns with status ARCHIVED are not shown
- **AND** a filter control allows filtering by status

#### Scenario: Row-actions menu offers contextual actions

- **WHEN** the operator clicks ⋯ on a campaign row
- **THEN** a dropdown appears with: Ver detalle, Editar, and Eliminar (destructive)
- **AND** if the campaign is PAUSED, an "Activar" option appears
- **AND** if the campaign is ACTIVE, a "Pausar" option appears instead
- **AND** if the campaign is not ARCHIVED, an "Archivar" option appears
- **AND** if the campaign is ARCHIVED, a "Restaurar" option appears instead

### Requirement: Manual outreach from a customer row

The portfolio accounts view SHALL offer a "Contactar manualmente" action in each customer
row's actions menu (the standard ⋯ row-actions menu, consistent with the campaigns and
agent-templates lists). Selecting it SHALL open a modal that lets the operator:

- select a **campaign** (required) — a manual contact runs that campaign's agent against
  this one customer,
- see which **agent and channel** will be used (derived from the selected campaign, shown
  as a note — not a separate picker),
- see a **channel-appropriate preview** of what will be sent (SMS/pre-recorded show the
  rendered message/script; Voz IA shows the rendered first message, or — when the Voz IA
  agent has no first message set — a muted placeholder indicating the agent will wait for
  the customer to start), and
- send, which dispatches the outreach and records it as a gestión of that campaign.

#### Scenario: Operator sends a manual outreach to one customer

- **WHEN** an operator opens the ⋯ menu on a customer row and chooses "Contactar manualmente"
- **THEN** a modal opens requiring the operator to select a campaign
- **AND** the agent and channel for that campaign are shown
- **AND** a channel-appropriate preview rendered with the customer's data is shown
- **AND** on send, the outreach is dispatched and a confirmation is shown

#### Scenario: Voz IA without a first message shows a waiting placeholder

- **WHEN** the selected campaign's agent is Voz IA and has no first message set
- **THEN** the preview shows a muted placeholder indicating the agent will wait for the
  customer to start, instead of a rendered first message

#### Scenario: Manual outreach is recorded as a gestión of the campaign

- **WHEN** a manual outreach dispatch succeeds
- **THEN** a gestión is recorded for that account carrying the selected campaign so the
  contact appears in the account's outreach history

### Requirement: Customer accounts table reserves the language field

The portfolio accounts (customer) table in the console SHALL NOT show a preferred-language
column. The `preferredLanguage` field SHALL remain on the account record as a reserved
field for future language-aware routing, but SHALL NOT be surfaced as a table column.

#### Scenario: Accounts table omits the language column

- **WHEN** an operator views a portfolio's customer accounts table
- **THEN** no preferred-language column is shown
- **AND** the `preferredLanguage` field remains stored on the account record
