## ADDED Requirements

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

## MODIFIED Requirements

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
