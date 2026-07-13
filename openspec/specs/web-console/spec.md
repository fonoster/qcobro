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

The console SHALL render all user-facing text through an internationalization layer rather than hardcoded literals, and the active language SHALL be configurable. No language SHALL be assumed as the only option. Every user-facing string on the operator console and the auth/onboarding screens SHALL resolve through the i18n layer, and the message catalogs for the supported locales SHALL have identical key sets (no locale missing a key).

#### Scenario: Text resolved via i18n

- **WHEN** a page renders user-facing copy
- **THEN** the copy is resolved through the i18n layer keyed by message identifiers

#### Scenario: Language is configurable

- **WHEN** the configured language is changed
- **THEN** the console renders user-facing text in the selected language without code changes

#### Scenario: Locales are at parity

- **WHEN** the message catalogs are compared across supported locales
- **THEN** every key present in one locale is present in all others

### Requirement: User language preference

The console SHALL let a user choose their language from the supported locales, persist that choice to their profile, and apply it on load and immediately on change. The persisted preference is the source of truth; a brand-new user gets the default language.

#### Scenario: Changing language persists and applies immediately

- **WHEN** a user selects a different language
- **THEN** the UI re-renders in that language without a reload
- **AND** the choice is persisted so it is applied again on the next visit, including on another device

#### Scenario: Language is restored on load

- **WHEN** a returning user opens the console
- **THEN** it renders in their saved language without first flashing the default

### Requirement: Contact verification after sign-up

After creating an account, the console SHALL take the user to a contact-verification
screen that sends a code to their email and accepts the code to confirm it. The screen
SHALL allow re-sending the code and SHALL let the user skip verification and continue
into the console (a soft gate). On verifying or skipping, the user SHALL continue into the
console landing on the workspaces hub.

#### Scenario: New account is taken to verification

- **WHEN** a user completes sign-up
- **THEN** they are taken to the contact-verification screen
- **AND** a verification code is sent to their email

#### Scenario: Entering the code completes verification

- **WHEN** the user enters the code from their email and submits
- **THEN** the contact is verified
- **AND** the user proceeds into the console, landing on the workspaces hub

#### Scenario: Code can be resent

- **WHEN** the user chooses "Reenviar código"
- **THEN** a new verification code is sent to their email

#### Scenario: Verification can be skipped

- **WHEN** the user chooses to skip verification
- **THEN** they continue into the console without verifying, landing on the workspaces hub

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
- **AND** the console leaves it, selecting another workspace or routing to the workspaces
  hub when none remain

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

The console SHALL provide a Mi perfil page, reachable from the in-app user menu and from
the account menu on the workspaces hub, where a user can edit their name and phone and see
their email as read-only. Saving SHALL persist the changes and confirm success. The profile
page SHALL be reachable without an active workspace.

#### Scenario: User opens their profile from the menu

- **WHEN** a user selects "Mi perfil" from the user menu or the workspaces-hub account menu
- **THEN** the profile page opens with their name, email (read-only), and phone

#### Scenario: User edits and saves their profile

- **WHEN** a user changes their name or phone and saves
- **THEN** the change is persisted
- **AND** a success indication is shown

#### Scenario: Profile is reachable without a workspace

- **WHEN** a user who has no workspace opens their profile from the account menu
- **THEN** the profile page opens
- **AND** they are not redirected to the workspaces hub

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

### Requirement: Post-authentication landing on the workspaces hub

After authenticating, the console SHALL take the user to the workspaces hub (served at
`/workspaces`) rather than directly into a workspace dashboard. The hub lists the user's
workspaces and offers workspace creation. Selecting a workspace SHALL enter that
workspace's dashboard. An authenticated user who has no workspaces SHALL also be routed to
the hub.

#### Scenario: Login lands on the workspaces hub

- **WHEN** a user logs in successfully
- **THEN** they are taken to the workspaces hub at `/workspaces`
- **AND** they are not dropped directly into a workspace dashboard

#### Scenario: Selecting a workspace enters it

- **WHEN** the user selects a workspace card on the hub
- **THEN** the console enters that workspace's dashboard

#### Scenario: Zero-workspace user is routed to the hub

- **WHEN** an authenticated user has no workspaces
- **THEN** the console routes them to the workspaces hub

### Requirement: Workspaces hub account menu

The workspaces hub SHALL provide an account menu, opened from the avatar, that lets the
user manage their account without first selecting or creating a workspace. The menu SHALL
show the user's name and email, and SHALL offer a link to the profile page, a language
switcher, and a log-out action. Logging out SHALL clear the session and return the user to
login.

#### Scenario: Account menu opens from the avatar

- **WHEN** a user clicks the avatar on the workspaces hub
- **THEN** a menu opens showing their name and email
- **AND** options for Profile, language, and Log out

#### Scenario: User can log out from the hub

- **WHEN** the user selects Log out from the account menu
- **THEN** the session is cleared
- **AND** the user is returned to login

#### Scenario: User can switch language from the hub

- **WHEN** the user selects a different language in the account menu
- **THEN** the console applies that language

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
as a slide-over panel over the Gestiones list. It presents one of three detail shapes:

**One-way message (`SMS`, `VOICE_PRERECORDED`)** — the single message/script that was sent, the
delivery status, the AI insight, and channel metadata. It SHALL NOT show a conversation
transcript. For pre-recorded it SHALL additionally show the **call duration** (`durationSeconds`)
and MAY offer the replayable synthesized script; the replayable script SHALL be presented as a
distinct element from the call result, and the copy SHALL NOT state or imply that the account
holder heard the message (e.g. "Llamada entregada · 0:22", never "el cliente escuchó el mensaje").
The AI insight describes what was done (e.g. reminder sent) rather than the absence of a response.

**Threaded message (`EMAIL`, `WHATSAPP`)** — the ordered conversation thread (each message with
direction, sender, timestamp, body, and message id), the delivery status, the AI insight, and
channel metadata. It SHALL NOT show an audio player or a call transcript, but it SHALL render the
back-and-forth thread rather than a single "message that was sent".

**Voz IA (`VOICE_AI`)** — the recording, the transcript, the full AI analysis (sentiment, debt
reason, result, next step), and — when the gestión `outcome` is a payment commitment — the linked
`PaymentPromise`. When AI insights are enabled, generation is `onDemand`, and a Voz IA gestión has
a transcript but no analysis yet, opening the detail SHALL request analysis, show a generating
state, and then display the persisted analysis; when AI insights are disabled the analysis section
SHALL show a pending state and no analysis is requested.

#### Scenario: SMS gestión shows the sent message and delivery, no transcript

- **WHEN** the operator opens an SMS gestión
- **THEN** the sent message, its delivery status, the AI insight, and channel metadata are
  shown
- **AND** no audio player or conversation transcript is shown

#### Scenario: Pre-recorded gestión shows outcome, duration, and a separate replayable script

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose call was answered
- **THEN** the outcome ("Entregado") and the call duration are shown
- **AND** the replayable synthesized script is shown as a distinct element from the call result
- **AND** no copy states or implies the account holder heard the message
- **AND** no conversation transcript is shown

#### Scenario: Email gestión shows its thread, not a single sent message

- **WHEN** the operator opens an `EMAIL` gestión that has inbound and outbound messages
- **THEN** the ordered conversation thread is rendered
- **AND** no audio player or call transcript is shown

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

### Requirement: Delivery status field shows the reached-stage progression

The gestión detail's metadata delivery-status field ("Estado de entrega") SHALL render the delivery
lifecycle as an ordered, arrow-joined text progression (`→`) of the stages the attempt actually
reached — not as a separate stepper component and with no additional duplicate status field. Only
reached stages appear; the field carries no coloured pills (the console's restrained styling is
preserved) and all stage labels go through the i18n layer. The stages SHALL be channel-appropriate:

- `SMS` → `Enviado → Entregado` (or `Enviado` alone when not confirmed delivered)
- `VOICE_PRERECORDED` → `Enviado → Entregado` (or `Enviado` alone when never answered); the answered
  duration is shown in the separate `Duración` metadata field, not in this progression
- `VOICE_AI` → `Enviado → Contestado → Finalizada`
- `EMAIL` / `WHATSAPP` → `Enviado → Entregado → Leído → Respondido`

For the threaded channels (`EMAIL`, `WHATSAPP`) the progression SHALL show **at most one full
delivery cycle** and SHALL NOT repeat the cycle per message, so a long thread does not produce an
unbounded status string.

#### Scenario: Pre-recorded shows Enviado → Entregado, duration separate

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose call was answered for 0:22
- **THEN** the `Estado de entrega` field reads `Enviado → Entregado`
- **AND** the answered duration `0:22` appears in the `Duración` metadata field

#### Scenario: Unreached stage is omitted

- **WHEN** the operator opens an `SMS` gestión that was sent but not confirmed delivered
- **THEN** the `Estado de entrega` field reads `Enviado` with no delivered stage appended

#### Scenario: Threaded channel shows a single bounded cycle

- **WHEN** the operator opens a `WHATSAPP` gestión whose thread has multiple back-and-forth messages
- **THEN** the `Estado de entrega` field shows at most one `Enviado → Entregado → Leído → Respondido`
  cycle and does not repeat stages per message

### Requirement: Workspace settings — currency and timezone

The "Configuración del espacio" page SHALL let an operator view and edit the active
workspace's **currency** (`USD` | `DOP`) and **timezone** (IANA zone). Values are read and
saved through the workspace settings operation; all labels go through the i18n layer. The
portfolio create/edit form SHALL NOT offer a currency field — currency is set here, once,
for the whole workspace.

#### Scenario: Operator edits workspace currency and timezone

- **WHEN** an operator opens "Configuración del espacio" and saves a currency and timezone
- **THEN** the workspace settings are updated
- **AND** money across the console (dashboard, portfolios, payment promises) is formatted in
  the chosen currency

#### Scenario: Portfolio form has no currency field

- **WHEN** an operator creates or edits a portfolio
- **THEN** the form does not present a currency selector

### Requirement: Workspace creation collects currency and timezone

The workspace-creation form on the workspaces hub SHALL collect the new workspace's
**currency** (`USD` | `DOP`) and **timezone** (IANA zone) in addition to its name, and SHALL
submit them so the workspace's settings are configured at creation. All labels go through
the i18n layer.

#### Scenario: Operator sets currency and timezone when creating a workspace

- **WHEN** an operator fills the workspace-creation form with a name, currency, and timezone and submits
- **THEN** the workspace is created with those settings
- **AND** money and campaign wall-clock interpretation use them immediately, without a separate visit to Configuración del espacio

### Requirement: Workspace accessKeyId is visible and copyable

The console SHALL display each workspace's `accessKeyId` to the operator and SHALL provide
a one-click affordance to copy it to the clipboard, so operators can use it for SDK and API
integration (the `x-workspace` header and `useWorkspace(accessKeyId)`). The `accessKeyId`
SHALL be shown on the workspace picker cards and on the dashboard for the active workspace.
The displayed value SHALL be the `accessKeyId` already present on the workspace payload; no
secret is exposed. All labels and copy-confirmation text SHALL resolve through the i18n
layer.

#### Scenario: accessKeyId shown on each workspace card

- **WHEN** the operator views the workspace picker at `/workspaces`
- **THEN** each workspace card displays that workspace's `accessKeyId`

#### Scenario: Copy accessKeyId from a workspace card

- **WHEN** the operator activates the copy affordance on a workspace card
- **THEN** that workspace's `accessKeyId` is written to the clipboard
- **AND** a transient confirmation is shown
- **AND** activating the copy affordance does not select/switch into that workspace

#### Scenario: Active workspace accessKeyId shown on the dashboard

- **WHEN** the operator views the Panel de control with an active workspace selected
- **THEN** the dashboard displays the active workspace's `accessKeyId` in a small area near the page header with a copy affordance

#### Scenario: Copy accessKeyId from the dashboard

- **WHEN** the operator activates the copy affordance on the dashboard
- **THEN** the active workspace's `accessKeyId` is written to the clipboard
- **AND** a transient confirmation is shown

### Requirement: Portfolio account detail dialog

The "Ver detalle" action on a row in a portfolio's accounts table SHALL open a dialog
showing the account's basic fields (outstanding balance, days past due, phone, email)
and a collapsed "Ver metadata" section. Expanding "Ver metadata" SHALL reveal every
other field on the account record — everything not already shown in the basic fields —
as a formatted JSON tree. The basic fields SHALL remain visible whether or not "Ver
metadata" is expanded.

#### Scenario: Operator opens the basic account detail view

- **WHEN** an operator clicks "Ver detalle" on an account row
- **THEN** a dialog opens showing the account's balance, days past due, phone, and email
- **AND** the "Ver metadata" section is present but collapsed

#### Scenario: Operator expands the full record

- **WHEN** an operator clicks "Ver metadata" in the account detail dialog
- **THEN** the remaining fields of the account record are shown as a JSON tree
- **AND** the basic fields remain visible above it

#### Scenario: Newly added account fields are visible without an app change

- **WHEN** the account record gains a new field not covered by the basic-fields summary
- **THEN** that field appears under "Ver metadata" once expanded, without requiring the
  dialog's basic-fields list to be updated

### Requirement: Portfolio list shows last synced time

The portfolio list page SHALL show a "last synced" column indicating the timestamp of the most recent completed CSV sync for each portfolio, formatted per the console's active locale.

#### Scenario: Portfolio has been synced

- **WHEN** an operator views the portfolio list
- **AND** a portfolio's `lastSyncedAt` is set
- **THEN** that portfolio's row shows the localized date/time of `lastSyncedAt`

#### Scenario: Portfolio has never been synced

- **WHEN** an operator views the portfolio list
- **AND** a portfolio's `lastSyncedAt` is `null`
- **THEN** that portfolio's row shows a localized "Never synced" placeholder instead of a date
