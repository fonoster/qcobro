## MODIFIED Requirements

### Requirement: Channel-aware Detalle de gestión

The operator console gestión detail SHALL adapt to the channel of the attempt and SHALL open
as a slide-over panel over the Gestiones list. It presents one of three detail shapes:

**One-way message (`SMS`, `VOICE_PRERECORDED`)** — the single message/script that was sent, the
entrega, the AI insight, and channel metadata. It SHALL NOT show a conversation transcript or a
`Camino` field, because those channels have no observable interaction path. It SHALL NOT show a
`Resultado` row **except** on `VOICE_PRERECORDED` when its DTMF opt-out was pressed (see
`account-contact-log`), in which case `Resultado` renders like any other channel — `SMS` never
shows a `Resultado` row, having no inbound path at all. For pre-recorded it SHALL additionally
show the **call duration** (`durationSeconds`) and MAY offer the replayable synthesized script;
the replayable script SHALL be presented as a distinct element from the call result, and the
copy SHALL NOT state or imply that the account holder heard the message (e.g. "Llamada
entregada · 0:22", never "el cliente escuchó el mensaje"). The AI insight describes what was
done (e.g. reminder sent) rather than the absence of a response.

**Threaded message (`EMAIL`, `WHATSAPP`)** — the ordered conversation thread (each message with
direction, sender, timestamp, body, and message id), the entrega, the camino, the AI insight,
and channel metadata. It SHALL NOT show an audio player or a call transcript, but it SHALL
render the back-and-forth thread rather than a single "message that was sent".

**Voz IA (`VOICE_AI`)** — the recording, the transcript, the full AI analysis (sentiment, debt
reason, result, next step), and — when the gestión `resultado` is a payment commitment — the
linked `PaymentPromise`. When AI insights are enabled, generation is `onDemand`, and a Voz IA
gestión has a transcript but no analysis yet, opening the detail SHALL request analysis, show a
generating state, and then display the persisted analysis; when AI insights are disabled the
analysis section SHALL show a pending state and no analysis is requested.

#### Scenario: SMS gestión shows the sent message and entrega, no transcript

- **WHEN** the operator opens an SMS gestión
- **THEN** the sent message, its entrega, the AI insight, and channel metadata are shown
- **AND** no audio player or conversation transcript is shown
- **AND** no `Camino` field and no `Resultado` row are shown

#### Scenario: Pre-recorded gestión shows entrega, duration, and a separate replayable script

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose call was answered and whose
  `resultado` is null (no DTMF menu configured, or the caller pressed nothing/an unrecognized
  digit)
- **THEN** the entrega ("Entregado") and the call duration are shown
- **AND** the replayable synthesized script is shown as a distinct element from the call result
- **AND** no copy states or implies the account holder heard the message
- **AND** no conversation transcript is shown
- **AND** no `Camino` field and no `Resultado` row are shown

#### Scenario: Pre-recorded gestión with an opt-out shows a Resultado row

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose `resultado` is `OPT_OUT`
- **THEN** the entrega, duration, and replayable script render exactly as any other
  pre-recorded gestión
- **AND** a `Resultado` row is additionally shown, reading the opt-out value
- **AND** no `Camino` field is shown — this channel never sets `camino`

#### Scenario: Email gestión shows its thread, not a single sent message

- **WHEN** the operator opens an `EMAIL` gestión that has inbound and outbound messages
- **THEN** the ordered conversation thread is rendered
- **AND** no audio player or call transcript is shown

#### Scenario: Voz IA gestión shows audio, transcript, and analysis

- **WHEN** the operator opens a Voz IA gestión that has a recording and transcript
- **THEN** the audio player and transcript are shown alongside the full AI analysis and,
  when `resultado` is a payment commitment, the linked `PaymentPromise`

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
