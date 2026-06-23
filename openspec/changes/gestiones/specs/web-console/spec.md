## ADDED Requirements

### Requirement: Gestiones list page

The operator console SHALL have a "Gestiones" page accessible from the sidebar. It SHALL
display recorded outreach attempts (`AccountContactLog`) for the active workspace in a
table. Each row SHALL show: account/customer identity, channel, outcome, the AI summary,
and a timestamp, with a way to open the gestión detail.

#### Scenario: Operator opens a gestión from the list

- **WHEN** the operator clicks a row in the Gestiones list
- **THEN** the Detalle de gestión screen for that contact log opens

### Requirement: Detalle de gestión page

The operator console SHALL have a gestión detail screen showing the full record of one
outreach attempt: an audio player (when a recording exists), the call transcript, the AI
analysis (summary, sentiment, debt reason, result, next step), channel metadata, and any
linked Objectives.

#### Scenario: Voice gestión shows audio and transcript

- **WHEN** the operator opens a gestión that has a recording and transcript
- **THEN** the audio player and transcript are shown alongside the AI analysis and linked
  objectives

### Requirement: Objetivos list page

The operator console SHALL have an "Objetivos" page accessible from the sidebar showing
all `Objective` records for the active workspace in a table with a KPI strip. It
generalizes and replaces the legacy "Promesas de Pago" screen.

#### Scenario: Operator reviews objectives

- **WHEN** the operator navigates to the Objetivos page
- **THEN** objectives are listed with their type, status, due/promise date, and linked
  account
- **AND** a KPI strip summarizes objectives by status

### Requirement: Sidebar navigation includes all sections

The operator console sidebar SHALL include navigation entries for Agentes, Campañas,
Gestiones, and Objetivos.

#### Scenario: Sidebar exposes Gestiones and Objetivos

- **WHEN** an authenticated operator views any console page
- **THEN** the sidebar shows Agentes, Campañas, Gestiones, and Objetivos entries
