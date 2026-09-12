## MODIFIED Requirements

### Requirement: Voice template config fields

Voice templates (`VOICE_AI` and `VOICE_PRERECORDED`) SHALL store the following in
their respective child tables:

**VoiceAiConfig** (for `VOICE_AI`):

- `fonosterAppName String` — the name of the Fonoster application
- `fonosterAppRef String?` — the Fonoster application ID, populated after sync
- `voice String` — voice identifier (provider-specific, e.g. ElevenLabs voice ID)
- `systemPrompt String` — the AI agent's persona and instructions
- `firstMessage String?` — the opening line spoken to the contact; optional, an agent may
  rely on the system prompt alone with no scripted opening line
- `language String` — default language code (e.g. `es`, `en`)
- `idleMessage String` — the line the agent speaks when the caller has gone silent,
  prompting them to re-engage; non-empty
- `idleTimeout Int` — how long, in **milliseconds**, the agent waits for caller speech
  before speaking `idleMessage`; an integer of at least `3000`, with no upper bound
- `idleMaxTimeoutCount Int` — how many consecutive idle timeouts the agent tolerates
  before ending the call; an integer of at least `1`, with no upper bound

The three idle fields are conceptually required — the database columns are NOT NULL, the
console form rejects an empty value, and every synced Fonoster application always carries
them — but a template saved without them explicitly set SHALL be stored with the
deployment's idle-option defaults rather than rejected. The defaults are a single value
shared by the migration backfill, the console create form's pre-fill, and the ephemeral
evaluation path.

**VoicePrerecordedConfig** (for `VOICE_PRERECORDED`):

- `fonosterAppName String` — the name of the Fonoster application
- `fonosterAppRef String?` — the Fonoster application ID, populated after sync
- `voice String` — voice identifier used for TTS generation
- `script String` — the full script text to be converted to speech
- `language String` — language code for TTS synthesis
- `repeatDigit String?` — single DTMF digit (`0`-`9`) that replays the script; unset means no
  repeat option is offered
- `repeatMessage String?` — spoken prompt played (once, after the script) inviting the caller
  to press `repeatDigit`; required exactly when `repeatDigit` is set
- `maxRepeats Int?` — how many times the script may be replayed in one call; only meaningful
  when `repeatDigit` is set; defaults to 2 when omitted
- `optOutDigit String?` — single DTMF digit that records an opt-out and ends the call; unset
  means no opt-out option is offered
- `optOutMessage String?` — spoken prompt inviting the caller to press `optOutDigit`; required
  exactly when `optOutDigit` is set
- `optOutConfirmationMessage String?` — spoken prompt played once `optOutDigit` is detected,
  before hangup, closing the interaction out for the caller instead of ending the call with no
  acknowledgment; required exactly when `optOutDigit` is set
- `hangupOnMachineDetected Boolean` — when `true` (the default), the call hangs up instead
  of playing the script if Fonoster's answering-machine detection reports the call was
  picked up by a machine (see `prerecorded-audio`). Has no observable effect unless AMD is
  enabled upstream for the call.

`VOICE_PRERECORDED` SHALL NOT carry a `firstMessage` field — the `script` is the
complete spoken content.

A template with neither `repeatDigit` nor `optOutDigit` set offers no DTMF menu at all —
this is the default, and it is behaviorally identical to a template saved before this
capability existed.

#### Scenario: Voice template syncs to Fonoster on save

- **WHEN** an operator saves a voice agent template
- **THEN** the system attempts to create or update the corresponding Fonoster application
- **AND** on success, `fonosterAppRef` is populated with the Fonoster application ID
- **AND** the template UI shows a "Sincronizado" status indicator

#### Scenario: VOICE_AI template saved without a first message

- **WHEN** an operator saves a VOICE_AI template leaving the first message empty
- **THEN** the template is saved with no first message
- **AND** the agent relies on its system prompt for the opening of the conversation

#### Scenario: VOICE_AI template carries per-template idle options to Fonoster

- **WHEN** an operator saves a VOICE_AI template with `idleMessage`, `idleTimeout`, and
  `idleMaxTimeoutCount` set
- **THEN** the values are persisted on the `VoiceAiConfig` row
- **AND** the synced Fonoster application's `conversationSettings.idleOptions` carries
  `message`, `timeout`, and `maxTimeoutCount` equal to those three values, overriding any
  deployment-wide default

#### Scenario: VOICE_AI template saved without explicit idle options gets the deployment defaults

- **WHEN** a VOICE_AI template is created without `idleMessage`, `idleTimeout`, or
  `idleMaxTimeoutCount` supplied (for example an `agents:create` call or an eval template
  that omits them)
- **THEN** the template is stored with the deployment's default idle message, default idle
  timeout in milliseconds, and default max timeout count
- **AND** those same default values are what the synced Fonoster application's
  `conversationSettings.idleOptions` carries

#### Scenario: Idle timeout below the minimum is rejected

- **WHEN** an operator saves a VOICE_AI template with `idleTimeout` less than `3000`
  milliseconds, or `idleMaxTimeoutCount` less than `1`, or an empty `idleMessage`
- **THEN** the save is rejected with a structured validation error naming the offending
  field

#### Scenario: Template saves locally even if Fonoster sync fails

- **WHEN** the Fonoster API is unavailable during a template save
- **THEN** the template is saved locally with `fonosterAppRef` remaining null
- **AND** the UI shows an "Error de sincronización" warning
- **AND** the operator can retry the sync manually

#### Scenario: A DTMF digit requires its message

- **WHEN** an operator saves a `VOICE_PRERECORDED` template with `repeatDigit` set and
  `repeatMessage` empty (or vice versa)
- **THEN** the save is rejected with a structured validation error naming the missing field
- **AND** the same rule applies independently to `optOutDigit`/`optOutMessage`

#### Scenario: The opt-out digit also requires its confirmation message

- **WHEN** an operator saves a `VOICE_PRERECORDED` template with `optOutDigit` and
  `optOutMessage` set but `optOutConfirmationMessage` empty
- **THEN** the save is rejected with a structured validation error naming the missing field
- **AND** setting `optOutConfirmationMessage` with `optOutDigit` empty is rejected the same way

#### Scenario: Repeat and opt-out digits must differ

- **WHEN** an operator saves a `VOICE_PRERECORDED` template with `repeatDigit` and
  `optOutDigit` both set to the same digit
- **THEN** the save is rejected with a structured validation error

#### Scenario: A template with no digits configured is unchanged from before this capability

- **WHEN** an operator saves a `VOICE_PRERECORDED` template leaving both digit fields empty
- **THEN** the template saves with no DTMF menu, identical to a pre-existing template

#### Scenario: A new VOICE_PRERECORDED template defaults to hanging up on a detected machine

- **WHEN** an operator creates a `VOICE_PRERECORDED` template without explicitly setting
  `hangupOnMachineDetected`
- **THEN** the template is stored with `hangupOnMachineDetected: true`

#### Scenario: An operator turns off the hang-up behavior for one template

- **WHEN** an operator saves a `VOICE_PRERECORDED` template with `hangupOnMachineDetected`
  set to `false`
- **THEN** the template is stored with that value
- **AND** a detected machine on a call dispatched from that template does not trigger a
  hang-up (see `prerecorded-audio`)
