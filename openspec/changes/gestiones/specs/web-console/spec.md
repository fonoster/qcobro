## ADDED Requirements

### Requirement: Gestiones list page

The operator console SHALL have a "Gestiones" page accessible from the sidebar that lists
recorded outreach attempts (`AccountContactLog`) for the active workspace in a table. Each
row SHALL show the account/customer identity, the **channel**, the outcome, the **AI
summary** of what happened, and the contact timestamp, with a way to open the gestión
detail. The table SHALL be filterable by channel and by outcome. The table presentation is
restrained (monochrome channel indicator, plain-text outcome — no coloured pills).

#### Scenario: Operator opens a gestión from the list

- **WHEN** the operator clicks a row in the Gestiones list
- **THEN** the Detalle de gestión screen for that contact log opens

#### Scenario: Channel and AI summary are visible per row

- **WHEN** the Gestiones list renders a recorded attempt
- **THEN** the row shows the channel (e.g. SMS) and the AI summary of the attempt

### Requirement: Channel-aware Detalle de gestión

The operator console gestión detail SHALL adapt to the **channel** of the attempt.

For **one-way** channels (SMS, pre-recorded, email) it SHALL show the message that was sent,
the delivery status, the AI insight, and channel metadata, and SHALL NOT show an audio
player or a conversation transcript. The AI insight describes what was done (e.g. reminder
delivered) rather than the absence of a response.

For **Voz IA** it SHALL additionally show the recording, the transcript, the full AI
analysis (sentiment, debt reason, result, next step), and any linked objectives.

SMS is the first channel implemented; the remaining channels follow the same channel-aware
detail in subsequent passes.

#### Scenario: SMS gestión shows the sent message and delivery, no transcript

- **WHEN** the operator opens an SMS gestión
- **THEN** the sent message, its delivery status, the AI insight, and channel metadata are
  shown
- **AND** no audio player or conversation transcript is shown

#### Scenario: Voz IA gestión shows audio, transcript, and analysis

- **WHEN** the operator opens a Voz IA gestión that has a recording and transcript
- **THEN** the audio player and transcript are shown alongside the full AI analysis and any
  linked objectives

## Deferred (designed, not in this change)

The following were designed during this change but are explicitly **out of implementation
scope** for now (tracked as follow-ups):

- **Objetivos** list page (KPI strip + table). The page already exists as a placeholder and
  is left untouched.
- **Voz IA `CONVERSATION_ENDED` webhook** ingestion — lands with the Voz IA channel pass.
- **Sidebar "Objetivos" nav item.**
