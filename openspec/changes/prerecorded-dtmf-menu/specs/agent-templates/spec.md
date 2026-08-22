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
