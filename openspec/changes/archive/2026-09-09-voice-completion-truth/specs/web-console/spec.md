## MODIFIED Requirements

### Requirement: Gestiones list page

The operator console SHALL have a "Gestiones" page accessible from the sidebar that lists
recorded outreach attempts (`AccountContactLog`) for the active workspace in a table. Each
row SHALL show the account/customer identity, the channel, the **delivery**, the **outcome**,
and the contact timestamp, with a way to open the gestión detail.

The `ENTREGA` cell SHALL render the delivery state, with the failure reason appended after a
middot when `delivery` is `FAILED` (e.g. `Fallido · Sin respuesta`). The `RESULTADO` cell SHALL
render an em dash when `outcome` is null, which is the common case.

The table SHALL be filterable by channel, by delivery, and by outcome, as three independent
filters. A single filter mixing delivery states and outcomes SHALL NOT be offered.

The list SHALL NOT show an AI-summary column: `aiSummary` is null until an insight is
generated, so the column is empty for most rows.

The table presentation is restrained (monochrome channel indicator, plain-text outcome — no
coloured pills). All labels go through the i18n layer.

#### Scenario: Operator opens a gestión from the list

- **WHEN** the operator clicks a row in the Gestiones list
- **THEN** the Detalle de gestión screen for that contact log opens

#### Scenario: Delivery and outcome are visible per row

- **WHEN** the Gestiones list renders a recorded attempt
- **THEN** the row shows the channel, the delivery, and the outcome

#### Scenario: A failed delivery shows its reason in the list

- **WHEN** the list renders a gestión with `delivery` `FAILED` and `deliveryReason` `NO_ANSWER`
- **THEN** the `ENTREGA` cell reads `Fallido · Sin respuesta`

#### Scenario: A gestión with no outcome shows an em dash

- **WHEN** the list renders a gestión whose `outcome` is null
- **THEN** the `RESULTADO` cell reads `—`

#### Scenario: Delivery and outcome filter independently

- **WHEN** the operator filters by delivery `DELIVERED` and outcome `PAYMENT_PROMISE`
- **THEN** only gestións matching both are listed

### Requirement: Channel-aware Detalle de gestión

The operator console gestión detail SHALL adapt to the channel of the attempt and SHALL open
as a slide-over panel over the Gestiones list. It presents one of three detail shapes:

**One-way message (`SMS`, `VOICE_PRERECORDED`)** — the single message/script that was sent, the
delivery, the AI insight, and channel metadata. `SMS` SHALL NOT show a conversation transcript, a
`Camino` field, or a `Resultado` row — it has no inbound path at all. `VOICE_PRERECORDED` SHALL
NOT show a conversation transcript, but SHALL show `Camino` and `Resultado` whenever they are
non-null (its optional DTMF menu is this channel's one source of either — see
`account-contact-log`); both stay hidden, exactly as on `SMS`, when null. For pre-recorded it
SHALL additionally show the **call duration** (`durationSeconds`) and MAY offer the replayable
synthesized script;
the replayable script SHALL be presented as a distinct element from the call result, and the
copy SHALL NOT state or imply that the account holder heard the message (e.g. "Llamada
entregada · 0:22", never "el cliente escuchó el mensaje"). The AI insight describes what was
done (e.g. reminder sent) rather than the absence of a response.

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

#### Scenario: Pre-recorded gestión shows delivery, duration, and a separate replayable script

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose call was answered and whose
  `path`/`outcome` are both null (no DTMF menu configured, or the caller pressed nothing/an
  unrecognized digit)
- **THEN** the delivery ("Entregado") and the call duration are shown
- **AND** the replayable synthesized script is shown as a distinct element from the call result
- **AND** no copy states or implies the account holder heard the message
- **AND** no conversation transcript is shown
- **AND** no `Camino` field and no `Resultado` row are shown

#### Scenario: Pre-recorded gestión with a repeat press shows a Camino field

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose `path` is `ENGAGED` and
  `outcome` is null (the caller pressed the repeat digit but not the opt-out digit)
- **THEN** the delivery, duration, and replayable script render exactly as any other
  pre-recorded gestión
- **AND** a `Camino` field is additionally shown, reading `Entregado → Conversación`
- **AND** no `Resultado` row is shown

#### Scenario: Pre-recorded gestión with an opt-out shows Camino and Resultado

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose `outcome` is `OPT_OUT`
- **THEN** the delivery, duration, and replayable script render exactly as any other
  pre-recorded gestión
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

### Requirement: Gestión detail shows delivery, path, and outcome as distinct fields

The gestión detail SHALL present the three axes as three distinct pieces of the panel, never
merged into one field:

- **`Entrega`** — a metadata field present on **every** gestión regardless of channel, rendering
  the delivery state as a single value: `Despachado`, `Entregado`, or `Fallido`. When `delivery`
  is `FAILED`, the `deliveryReason` SHALL be appended after a middot (e.g.
  `Fallido · Sin respuesta`). It SHALL NOT be a stepper component and SHALL carry no coloured
  pills.
- **`Camino`** — a metadata field shown only on channels that can observe an interaction
  (`VOICE_AI`, `EMAIL`, `WHATSAPP`, and `VOICE_PRERECORDED` when its DTMF menu produced one —
  see `account-contact-log`), rendering an ordered, arrow-joined (`→`) progression of the
  stages the interaction actually reached. Stages not reached are omitted. For threaded channels
  the progression SHALL show **at most one full cycle** and SHALL NOT repeat per message, so a
  long thread does not produce an unbounded string. `SMS` never shows `Camino` — it has no
  inbound path at all.
- **`Resultado`** — a standalone row in the panel body, **not** nested inside the AI-insights
  section, so it is shown whether or not an AI summary exists. It SHALL be rendered only when
  `outcome` is non-null.

When `outcome` is `PAYMENT_PROMISE`, the `Resultado` row is the payment-promise rendering:
the linked promise's amount and due date are shown in that row's area. A separate promise card
duplicating the same information SHALL NOT be shown.

All stage and value labels go through the i18n layer.

#### Scenario: Delivery is present on every channel

- **WHEN** the operator opens a gestión on any channel
- **THEN** an `Entrega` field is shown with one of `Despachado`, `Entregado`, or `Fallido`

#### Scenario: A failed delivery shows its reason inline

- **WHEN** the operator opens a gestión with `delivery` `FAILED` and `deliveryReason` `NO_ANSWER`
- **THEN** the `Entrega` field reads `Fallido · Sin respuesta`

#### Scenario: Path renders as an arrow progression

- **WHEN** the operator opens a `VOICE_AI` gestión whose call was answered and engaged
- **THEN** the `Camino` field reads `Despachado → Conversación`

#### Scenario: Path is always absent on SMS

- **WHEN** the operator opens an `SMS` gestión
- **THEN** no `Camino` field is shown

#### Scenario: Path is absent on a pre-recorded gestión with no DTMF engagement

- **WHEN** the operator opens a `VOICE_PRERECORDED` gestión whose `path` is null (no menu
  configured, or the caller pressed nothing/an unrecognized digit)
- **THEN** no `Camino` field is shown

#### Scenario: Outcome is shown without an AI summary

- **WHEN** the operator opens a gestión that has an `outcome` but no `aiSummary`
- **THEN** the `Resultado` row is still shown

#### Scenario: Outcome is hidden when null

- **WHEN** the operator opens a gestión whose `outcome` is null
- **THEN** no `Resultado` row is shown

#### Scenario: A payment promise is shown once, not twice

- **WHEN** the operator opens a gestión whose `outcome` is `PAYMENT_PROMISE`
- **THEN** the promise's amount and due date are shown in the `Resultado` row
- **AND** no separate duplicate promise card is shown

#### Scenario: Threaded channel shows a single bounded cycle

- **WHEN** the operator opens a `WHATSAPP` gestión whose thread has multiple back-and-forth
  messages
- **THEN** the `Camino` field shows at most one cycle and does not repeat stages per message
