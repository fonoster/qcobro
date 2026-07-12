## MODIFIED Requirements

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

## ADDED Requirements

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
