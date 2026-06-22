## ADDED Requirements

### Requirement: AgentTemplate as a first-class workspace entity

An `AgentTemplate` SHALL be a named, reusable agent configuration scoped to a workspace.
It SHALL have a `type` that determines which channel it operates on:
`VOICE_AI`, `VOICE_PRERECORDED`, `SMS`, `EMAIL`, `WHATSAPP`.

Type-specific configuration SHALL be stored in a separate child table linked by
`templateId` — never mixed into the base table. The base table holds only identity
fields: `id`, `workspaceRef`, `name`, `type`, `createdAt`, `updatedAt`.

The base table also holds a `collectionStrategy` field (`SOFT`, `MODERATE`, `FIRM`)
that informs both the agent's tone (for voice) and the message framing (for text
channels). This field is type-agnostic and lives on the base table.

Performance counters are maintained on the base record and updated by the system
as contact logs are written: `totalCalls`, `totalPromises`, `totalRecovered`,
`successRate`. These are read-only from the operator's perspective and drive the
agent template performance summary on the detail page.

#### Scenario: Operator creates a VOICE_AI template

- **WHEN** an operator submits the create agent template form with name, type VOICE_AI,
  voice selection, system prompt, first message, and language
- **THEN** a base `AgentTemplate` record is created
- **AND** a `VoiceAiConfig` child record is created linked to it
- **AND** the template appears in the agent templates list

#### Scenario: Operator creates an SMS template

- **WHEN** an operator submits the form with name, type SMS, and message body
- **THEN** a base `AgentTemplate` record is created
- **AND** an `SmsConfig` child record is created linked to it

#### Scenario: Template type is immutable after creation

- **WHEN** an operator attempts to change the type of an existing template
- **THEN** the system SHALL reject the update with a validation error

### Requirement: Voice template config fields

Voice templates (`VOICE_AI` and `VOICE_PRERECORDED`) SHALL store the following in
their respective child tables:

**VoiceAiConfig** (for `VOICE_AI`):

- `fonosterAppName String` — the name of the Fonoster application
- `fonosterAppRef String?` — the Fonoster application ID, populated after sync
- `voice String` — voice identifier (provider-specific, e.g. ElevenLabs voice ID)
- `systemPrompt String` — the AI agent's persona and instructions
- `firstMessage String` — the opening line spoken to the contact
- `language String` — default language code (e.g. `es`, `en`)

**VoicePrerecordedConfig** (for `VOICE_PRERECORDED`):

- `fonosterAppName String` — the name of the Fonoster application
- `fonosterAppRef String?` — the Fonoster application ID, populated after sync
- `voice String` — voice identifier used for TTS generation
- `script String` — the full script text to be converted to speech
- `firstMessage String` — the opening line (may differ from full script)
- `language String` — language code for TTS synthesis

#### Scenario: Voice template syncs to Fonoster on save

- **WHEN** an operator saves a voice agent template
- **THEN** the system attempts to create or update the corresponding Fonoster application
- **AND** on success, `fonosterAppRef` is populated with the Fonoster application ID
- **AND** the template UI shows a "Sincronizado" status indicator

#### Scenario: Template saves locally even if Fonoster sync fails

- **WHEN** the Fonoster API is unavailable during a template save
- **THEN** the template is saved locally with `fonosterAppRef` remaining null
- **AND** the UI shows an "Error de sincronización" warning
- **AND** the operator can retry the sync manually

### Requirement: Text channel template config fields

Text channel templates SHALL store the following in their respective child tables:

**SmsConfig** (for `SMS`):

- `messageBody String` — message text; supports `{{firstName}}`, `{{lastName}}`,
  `{{outstandingBalance}}` placeholders
- `senderId String?` — optional sender identifier

**EmailConfig** (for `EMAIL`):

- `subject String` — email subject line; supports placeholders
- `messageBody String` — email body (plain text or HTML); supports placeholders
- `fromName String` — display name for the sender
- `fromEmail String` — sender email address

**WhatsAppConfig** (for `WHATSAPP`):

- `templateName String` — WhatsApp pre-approved template name
- `messageBody String` — template body with placeholders

#### Scenario: Message body supports account placeholders

- **WHEN** the engine dispatches an SMS using a template with `{{firstName}}` in the body
- **THEN** the placeholder is replaced with the account holder's first name before sending

### Requirement: A campaign references one AgentTemplate

A `Campaign` SHALL reference exactly one `AgentTemplate` by ID. The template determines
the channel used for all dispatches in that campaign. The `agentTemplateId` is
immutable after campaign creation.

#### Scenario: Campaign cannot reference a template from another workspace

- **WHEN** an operator attempts to create a campaign referencing a template not owned
  by the active workspace
- **THEN** the system SHALL reject the request with a validation error

#### Scenario: Campaign list for template selection shows only workspace templates

- **WHEN** the operator opens the agent template selector in the create campaign modal
- **THEN** only templates belonging to the active workspace are shown
