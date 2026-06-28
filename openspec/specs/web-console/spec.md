# web-console Specification

## Purpose

TBD - created by archiving change project-foundation. Update Purpose after archive.

## Requirements

### Requirement: React + Vite console shell

The web console SHALL be a React single-page application built with Vite and styled with Tailwind CSS. It SHALL provide an application shell with client-side routing into which feature pages are mounted in later changes.

#### Scenario: App builds and serves

- **WHEN** `npm run build` is executed for the `webapp` package
- **THEN** Vite produces a production build without type or build errors

#### Scenario: Shell provides routing

- **WHEN** the console is loaded
- **THEN** an application shell renders and client-side routing resolves a default route

### Requirement: Type-safe API client wiring

The console SHALL communicate with the apiserver through a tRPC client typed against the apiserver's `AppRouter`, so that API calls are end-to-end type-checked.

#### Scenario: Client is typed against the server

- **WHEN** the console's tRPC client is inspected
- **THEN** it is parameterized by the `AppRouter` type exported by the apiserver

### Requirement: Internationalization-ready text

The console SHALL render all user-facing text through an internationalization layer rather than hardcoded literals, and the active language SHALL be configurable. No language SHALL be assumed as the only option.

#### Scenario: Text resolved via i18n

- **WHEN** a page renders user-facing copy
- **THEN** the copy is resolved through the i18n layer keyed by message identifiers

#### Scenario: Language is configurable

- **WHEN** the configured language is changed
- **THEN** the console renders user-facing text in the selected language without code changes

### Requirement: Contact verification after sign-up

After creating an account, the console SHALL take the user to a contact-verification
screen that sends a code to their email and accepts the code to confirm it. The screen
SHALL allow re-sending the code and SHALL let the user skip verification and continue
into the console (a soft gate).

#### Scenario: New account is taken to verification

- **WHEN** a user completes sign-up
- **THEN** they are taken to the contact-verification screen
- **AND** a verification code is sent to their email

#### Scenario: Entering the code completes verification

- **WHEN** the user enters the code from their email and submits
- **THEN** the contact is verified
- **AND** the user proceeds into the console

#### Scenario: Code can be resent

- **WHEN** the user chooses "Reenviar código"
- **THEN** a new verification code is sent to their email

#### Scenario: Verification can be skipped

- **WHEN** the user chooses to skip verification
- **THEN** they continue into the console without verifying

### Requirement: Workspace Danger Zone is owner-only

The Workspace Configuration page SHALL show a Danger Zone with a delete-workspace
action only to the workspace owner. Admins and members SHALL NOT see it.

#### Scenario: Owner sees the Danger Zone

- **WHEN** the workspace owner opens the configuration page
- **THEN** an "Eliminar espacio" Danger Zone card is shown

#### Scenario: Non-owner does not see the Danger Zone

- **WHEN** an admin or member opens the configuration page
- **THEN** no delete-workspace action is shown

### Requirement: Workspace deletion is type-to-confirm

Deleting a workspace SHALL require the owner to type the confirmation word `ELIMINAR`
before the destructive button is enabled. The dialog SHALL name the workspace being
deleted.

#### Scenario: Confirm button gates on the typed word

- **WHEN** the owner opens the delete dialog
- **THEN** the destructive button is disabled
- **AND** it becomes enabled only once the owner types `ELIMINAR`

#### Scenario: Deletion leaves the workspace

- **WHEN** the owner confirms deletion
- **THEN** the workspace is deleted
- **AND** the console leaves it, selecting another workspace or routing to workspace
  creation when none remain

### Requirement: Member row actions

The Members page SHALL provide a per-row actions menu. For a **pending** member it SHALL
offer resend-invitation and cancel-invitation actions; for an **active** member it SHALL
offer a remove action. Resend SHALL call the resend-invitation operation and cancel/remove
SHALL call the remove-member operation.

The portfolio list page SHALL likewise provide a per-row ellipsis (⋯) actions menu
replacing individual buttons. The menu SHALL contain: Sincronizar CSV, Editar, and
Eliminar. This establishes the ellipsis menu as the standard row-action pattern for
list pages in the console.

#### Scenario: Pending member can be resent or cancelled

- **WHEN** an owner/admin opens the actions menu on a pending member
- **THEN** the menu offers "Reenviar invitación" and "Cancelar invitación"
- **AND** resend sends the invitation email again

#### Scenario: Active member can be removed

- **WHEN** an owner/admin opens the actions menu on an active member
- **THEN** the menu offers "Quitar miembro"
- **AND** confirming removes the member from the workspace

#### Scenario: Portfolio row ellipsis menu

- **WHEN** an operator clicks ⋯ on a portfolio row
- **THEN** a floating menu offers Sincronizar CSV, Editar, and Eliminar

### Requirement: Destructive member actions are confirmed

Removing a member or cancelling an invitation SHALL require confirmation via a simple
confirm dialog before the operation runs.

#### Scenario: Confirmation precedes removal

- **WHEN** an owner/admin chooses Quitar miembro or Cancelar invitación
- **THEN** a confirm dialog is shown
- **AND** the operation runs only after the destructive action is confirmed

### Requirement: Invitations collect a required name

The invite form SHALL collect a member name, which is required, and SHALL prevent
submission without it (the apiserver and Identity require a name on invitation).

#### Scenario: Invite without a name is blocked

- **WHEN** an owner/admin submits the invite form without a name
- **THEN** submission is prevented with a validation message

### Requirement: Profile page

The console SHALL provide a Mi perfil page, reachable from the user menu, where a user
can edit their name and phone and see their email as read-only. Saving SHALL persist the
changes and confirm success.

#### Scenario: User opens their profile from the menu

- **WHEN** a user selects "Mi perfil" from the user menu
- **THEN** the profile page opens with their name, email (read-only), and phone

#### Scenario: User edits and saves their profile

- **WHEN** a user changes their name or phone and saves
- **THEN** the change is persisted
- **AND** a success indication is shown

### Requirement: Account deletion is type-to-confirm

The profile page SHALL offer an account-deletion Danger Zone whose destructive button is
enabled only after the user types `ELIMINAR`. On success the session SHALL be cleared and
the user returned to login.

#### Scenario: Confirm button gates on the typed word

- **WHEN** the user opens the delete-account dialog
- **THEN** the destructive button is disabled
- **AND** it becomes enabled only once the user types `ELIMINAR`

#### Scenario: Deleting the account ends the session

- **WHEN** the user confirms account deletion
- **THEN** the account is deleted
- **AND** the session is cleared and the user is returned to login

### Requirement: Workspace card shows cartera and member counts

Each workspace card on the workspace landing screen SHALL show a meta line with the
number of carteras and members in that workspace, below the workspace name.
Until those counts are available from the API, the card SHALL render placeholder
values (0) so the layout matches the design.

#### Scenario: Card renders name and meta line

- **WHEN** a user views the workspace landing screen
- **THEN** each workspace card shows the workspace name
- **AND** a meta line of the form "N carteras · N miembros" is shown below it

### Requirement: Component development in Storybook

The console SHALL include Storybook so reusable components can be developed and reviewed in isolation.

#### Scenario: Storybook builds

- **WHEN** the Storybook build script is executed for the `webapp` package
- **THEN** a static Storybook is produced without errors

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

### Requirement: Manual outreach from a customer row

The portfolio accounts view SHALL offer a "Contactar manualmente" action in each customer
row's actions menu (the standard ⋯ row-actions menu, consistent with the campaigns and
agent-templates lists). Selecting it SHALL open a modal that lets the operator:

- select an **agent template** (required) — a manual contact dispatches that agent against
  this one customer; **no campaign is involved**,
- see the **channel** for the selected agent template,
- see a **channel-appropriate preview** of what will be sent (SMS/pre-recorded show the
  rendered message/script; Voz IA shows the rendered first message, or — when the Voz IA
  agent has no first message set — a muted placeholder indicating the agent will wait for
  the customer to start), and
- send, which dispatches the outreach and records it as a gestión with `campaignId` null and
  the chosen `agentTemplateId`.

A manual outreach SHALL NOT require or accept a campaign and SHALL NOT create or modify any
`CampaignAccountState` — keeping campaign account counts, attempt caps, and recovered-amount
attribution clean.

#### Scenario: Operator sends a manual outreach via an agent

- **WHEN** an operator opens the ⋯ menu on a customer row and chooses "Contactar manualmente"
- **THEN** a modal opens requiring the operator to select an agent template
- **AND** the channel for that agent template is shown
- **AND** a channel-appropriate preview rendered with the customer's data is shown
- **AND** on send, the outreach is dispatched and a confirmation is shown

#### Scenario: Voz IA without a first message shows a waiting placeholder

- **WHEN** the selected agent template is Voz IA and has no first message set
- **THEN** the preview shows a muted placeholder indicating the agent will wait for the
  customer to start, instead of a rendered first message

#### Scenario: Manual outreach is recorded as a campaign-less gestión

- **WHEN** a manual outreach dispatch succeeds
- **THEN** a gestión is recorded for that account with `campaignId` null and the chosen
  `agentTemplateId` so the contact appears in the account's outreach history
- **AND** no `CampaignAccountState` is created or modified

### Requirement: Payment Promises worklist

The operator console SHALL provide a **Payment Promises** section (replacing the former
"Objectives" section) that acts as a collector worklist across the active workspace. It
SHALL list payment promises with: account name, promised amount, due date, status, and days
until / past due, and SHALL clearly signal **DUE** promises (PENDING past their due date) as
needing attention. It SHALL show KPIs: total pending count, total amount pending, promises
due this week, and fulfillment rate (`MET / (MET + overdue-unresolved)`, excluding
`EXPIRED` and `CANCELLED`). All labels SHALL go through the i18n layer.

From the worklist an operator SHALL be able to resolve a promise: **mark it paid** (`MET`),
**cancel** it (`CANCELLED`), or **follow up** by selecting an agent template that is
dispatched ad-hoc against the account (no campaign attached). `EXPIRED` promises SHALL
remain visible, flagged as no longer applicable (do-not-reach), and excluded from the
fulfillment rate.

#### Scenario: Promises are listed with DUE signaling and KPIs

- **WHEN** an operator navigates to the Payment Promises section
- **THEN** payment promises for the workspace are listed with account name, amount, due
  date, status, and days until/past due
- **AND** promises that are PENDING past their due date are signaled as DUE
- **AND** the KPI strip shows total pending, total amount pending, promises due this week,
  and fulfillment rate

#### Scenario: Operator marks a promise paid from the worklist

- **WHEN** an operator marks a DUE promise as paid
- **THEN** its status becomes `MET` and it leaves the active worklist

#### Scenario: Operator follows up via an agent template

- **WHEN** an operator chooses to follow up on a DUE promise and selects an agent template
- **THEN** the template is dispatched against the account with no campaign attached
- **AND** the resulting follow-up gestión is linked to the promise

#### Scenario: Expired promises remain visible and do-not-reach

- **WHEN** a promise is `EXPIRED` (its account left the portfolio)
- **THEN** it remains visible on the worklist flagged as no longer applicable
- **AND** it is excluded from the fulfillment-rate KPI

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

### Requirement: Customer accounts table reserves the language field

The portfolio accounts (customer) table in the console SHALL NOT show a preferred-language
column. The `preferredLanguage` field SHALL remain on the account record as a reserved
field for future language-aware routing, but SHALL NOT be surfaced as a table column.

#### Scenario: Accounts table omits the language column

- **WHEN** an operator views a portfolio's customer accounts table
- **THEN** no preferred-language column is shown
- **AND** the `preferredLanguage` field remains stored on the account record

### Requirement: Gestiones list page

The operator console SHALL have a "Gestiones" page accessible from the sidebar that lists
recorded outreach attempts (`AccountContactLog`) for the active workspace in a table. Each
row SHALL show the account/customer identity, the channel, the outcome, the AI summary of
what happened, and the contact timestamp, with a way to open the gestión detail. The table
SHALL be filterable by channel and by outcome. The table presentation is restrained
(monochrome channel indicator, plain-text outcome — no coloured pills).

#### Scenario: Operator opens a gestión from the list

- **WHEN** the operator clicks a row in the Gestiones list
- **THEN** the Detalle de gestión screen for that contact log opens

#### Scenario: Channel and AI summary are visible per row

- **WHEN** the Gestiones list renders a recorded attempt
- **THEN** the row shows the channel (e.g. SMS) and the AI summary of the attempt

### Requirement: Channel-aware Detalle de gestión

The operator console gestión detail SHALL adapt to the channel of the attempt and SHALL open
as a slide-over panel over the Gestiones list.

For one-way channels (SMS, pre-recorded, email) it SHALL show the message that was sent, the
delivery status, the AI insight, and channel metadata, and SHALL NOT show an audio player or
a conversation transcript. The AI insight describes what was done (e.g. reminder delivered)
rather than the absence of a response.

For Voz IA it SHALL additionally show the recording, the transcript, the full AI analysis
(sentiment, debt reason, result, next step), and — when the gestión `outcome` is a payment
commitment — the linked `PaymentPromise`. When AI insights are
enabled, generation is `onDemand`, and a Voz IA gestión has a transcript but no analysis yet,
opening the detail SHALL request analysis, show a generating state, and then display the
persisted analysis; when AI insights are disabled the analysis section SHALL show a pending
state and no analysis is requested.

#### Scenario: SMS gestión shows the sent message and delivery, no transcript

- **WHEN** the operator opens an SMS gestión
- **THEN** the sent message, its delivery status, the AI insight, and channel metadata are
  shown
- **AND** no audio player or conversation transcript is shown

#### Scenario: Voz IA gestión shows audio, transcript, and analysis

- **WHEN** the operator opens a Voz IA gestión that has a recording and transcript
- **THEN** the audio player and transcript are shown alongside the full AI analysis and,
  when the outcome is a payment commitment, the linked `PaymentPromise`

#### Scenario: Voz IA analysis is generated on first open when missing

- **WHEN** AI insights are enabled (generation `onDemand`) and the operator opens a Voz IA
  gestión that has a transcript but no analysis yet
- **THEN** the panel shows a generating state, the analysis is produced from the transcript
  and persisted, and the analysis is then displayed
- **AND** opening the same gestión again shows the persisted analysis without regenerating

#### Scenario: Analysis stays pending when AI insights are disabled

- **WHEN** the operator opens a Voz IA gestión with a transcript but no analysis and AI
  insights are disabled
- **THEN** the analysis section shows a pending state and no LLM request is made
