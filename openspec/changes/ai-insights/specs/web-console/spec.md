## MODIFIED Requirements

### Requirement: Channel-aware Detalle de gestión

The operator console gestión detail SHALL adapt to the channel of the attempt and SHALL open
as a slide-over panel over the Gestiones list.

For one-way channels (SMS, pre-recorded, email) it SHALL show the message that was sent, the
delivery status, the AI insight, and channel metadata, and SHALL NOT show an audio player or
a conversation transcript. The AI insight describes what was done (e.g. reminder delivered)
rather than the absence of a response.

For Voz IA it SHALL additionally show the recording, the transcript, the full AI analysis
(sentiment, debt reason, result, next step), and any linked objectives. When AI insights are
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
- **THEN** the audio player and transcript are shown alongside the full AI analysis and any
  linked objectives

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
