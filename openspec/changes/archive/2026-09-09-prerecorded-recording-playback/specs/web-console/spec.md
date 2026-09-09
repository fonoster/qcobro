## MODIFIED Requirements

### Requirement: Channel-aware Detalle de gestión

The operator console gestión detail SHALL adapt to the channel of the attempt and SHALL open
as a slide-over panel over the Gestiones list. It presents one of three detail shapes:

**One-way message (`SMS`, `VOICE_PRERECORDED`)** — the single message/script that was sent, the
delivery, the AI insight, and channel metadata. `SMS` SHALL NOT show a conversation transcript, a
`Camino` field, or a `Resultado` row — it has no inbound path at all. `VOICE_PRERECORDED` SHALL
NOT show a conversation transcript, but SHALL show `Camino` and `Resultado` whenever they are
non-null (its optional DTMF menu is this channel's one source of either — see
`account-contact-log`); both stay hidden, exactly as on `SMS`, when null. For pre-recorded it
SHALL additionally show the **call duration** (`durationSeconds`) and, whenever a recording
resolves (see `prerecorded-audio`), the **actual call recording** as an audio player — never a
synthesized re-narration of the script. The player is shown regardless of `delivery`, and is
replaced by an explicit unavailable state when no recording resolves. The script that was sent
SHALL still be shown as a separate, read-only element (it is a text record of what was sent, not
a claim that it plays back), and the copy SHALL NOT state or imply that the account holder heard
the message (e.g. "Llamada entregada · 0:22", never "el cliente escuchó el mensaje"). The AI
insight describes what was done (e.g. reminder sent) rather than the absence of a response.

**Threaded message (`EMAIL`, `WHATSAPP`)** — the ordered conversation thread (each message with
direction, sender, timestamp, body, and message id), the delivery, the path, the AI insight,
and channel metadata. It SHALL NOT show an audio player or a call transcript, but it SHALL
render the back-and-forth thread rather than a single "message that was sent".

**Voz IA (`VOICE_AI`)** — the recording, the transcript, the full AI analysis (sentiment, debt
reason, result, next step), and — when the gestión `outcome` is a payment commitment — the
linked `PaymentPromise`. When AI insights are enabled, generation is `onDemand`, and a Voz IA
gestión has a transcript but no analysis yet, opening the detail SHALL request analysis, show a
generating state, and then display the persisted analysis; when AI insights are disabled the
analysis section SHALL show a pending state and no analysis is requested.

#### Scenario: SMS gestión shows the sent message and delivery, no transcript

- **WHEN** the operator opens an SMS gestión
- **THEN** the sent message, its delivery, the AI insight, and channel metadata are shown
- **AND** no audio player or conversation transcript is shown
- **AND** no `Camino` field and no `Resultado` row are shown

#### Scenario: Pre-recorded gestión shows delivery, duration, its call recording, and the sent script

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose call was answered, whose
  `path`/`outcome` are both null (no DTMF menu configured, or the caller pressed
  nothing/an unrecognized digit), and whose recording resolves
- **THEN** the delivery ("Entregado") and the call duration are shown
- **AND** an audio player plays the actual call recording
- **AND** the script that was sent is shown as a separate, read-only element from the
  call recording
- **AND** no copy states or implies the account holder heard the message
- **AND** no conversation transcript is shown
- **AND** no `Camino` field and no `Resultado` row are shown

#### Scenario: Pre-recorded gestión with a repeat press shows a Camino field

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose `path` is `ENGAGED` and
  `outcome` is null (the caller pressed the repeat digit but not the opt-out digit)
- **THEN** the delivery, duration, recording player, and sent script render exactly as any
  other pre-recorded gestión
- **AND** a `Camino` field is additionally shown, reading `Despachado → Recibido`
- **AND** no `Resultado` row is shown

#### Scenario: Pre-recorded gestión with an opt-out shows Camino and Resultado

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose `outcome` is `OPT_OUT`
- **THEN** the delivery, duration, recording player, and sent script render exactly as any
  other pre-recorded gestión
- **AND** both a `Camino` field (`ENGAGED`) and a `Resultado` row (the opt-out value) are shown

#### Scenario: Email gestión shows its thread, not a single sent message

- **WHEN** the operator opens an `EMAIL` gestión that has inbound and outbound messages
- **THEN** the ordered conversation thread is rendered
- **AND** no audio player or call transcript is shown

#### Scenario: Voz IA gestión shows audio, transcript, and analysis

- **WHEN** the operator opens a Voz IA gestión that has a recording and transcript
- **THEN** the audio player and transcript are shown alongside the full AI analysis and,
  when `outcome` is a payment commitment, the linked `PaymentPromise`

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
