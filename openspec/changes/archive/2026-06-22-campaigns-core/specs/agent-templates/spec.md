## ADDED Requirements

### Requirement: AgentTemplate as a first-class workspace entity

An `AgentTemplate` SHALL be a named, reusable agent configuration scoped to a workspace.
It SHALL have a `type` that determines which channel it operates on:
`VOICE_AI`, `VOICE_PRERECORDED`, `SMS`, `EMAIL`, `WHATSAPP`.

Type-specific configuration SHALL be stored in a separate child table linked by
`templateId` — never mixed into the base table. The base table holds only identity
fields: `id`, `workspaceRef`, `name`, `type`, `archivedAt`, `createdAt`, `updatedAt`.

The base table SHALL NOT carry a `collectionStrategy` field, nor any performance
counters (`totalCalls`, `totalPromises`, `totalRecovered`, `successRate`). Agent
templates are pure configuration; outreach outcomes are recorded on contact logs and
aggregated at query time where needed, not denormalized onto the template.

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

### Requirement: Agent template archived state is a single timestamp

An `AgentTemplate` SHALL NOT carry a status enum. Instead it has an optional `archivedAt`
timestamp: when unset the template is **active**, when set it is **archived** and hidden
from the default list. Archiving and restoring are toggles, not status selections. The
agent templates list SHALL default to showing only active templates; archived templates
SHALL only appear when the operator enables a "Mostrar archivados" toggle.

#### Scenario: Operator archives a template

- **WHEN** an operator archives an agent template from its row actions
- **THEN** the template's `archivedAt` is set to the current time
- **AND** the template is hidden from the default list

#### Scenario: Operator restores a template

- **WHEN** an operator restores an archived template
- **THEN** the template's `archivedAt` is cleared
- **AND** the template reappears in the default list

#### Scenario: Default list excludes archived templates

- **WHEN** the agent templates list is loaded with the toggle off
- **THEN** only templates with no `archivedAt` are returned

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
- `language String` — language code for TTS synthesis

`VOICE_PRERECORDED` SHALL NOT carry a `firstMessage` field — the `script` is the
complete spoken content.

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

### Requirement: Voice catalog is sourced from deployment config

The set of selectable voices SHALL come from the deployment configuration
(`qcobro.json`), not from free-text entry. Each voice entry carries an `id`, `name`,
`language`, `gender`, and `provider` (default `elevenlabs`). The API SHALL expose the
voice catalog through a config query so the console can render a voice picker, and the
stored `voice` value SHALL be one of the catalog `id`s.

#### Scenario: Voice picker is populated from the configured catalog

- **WHEN** an operator opens the voice selector in a voice agent template form
- **THEN** the options shown are the voices configured in `qcobro.json`, labeled by
  name, language, and gender (e.g. "Sofía (es, femenina)")
- **AND** the saved template stores the selected voice's `id`

### Requirement: Documented template variables

The agent templates console SHALL surface a few example template variables and a link
to documentation that lists the full set. Templates may embed these account
placeholders, which the engine substitutes before dispatch; the supported set includes
the firstName, lastName, principalAmount, and outstandingBalance variables.

#### Scenario: Console links operators to the template-variable reference

- **WHEN** an operator views the agent templates list
- **THEN** the page shows example variables (firstName, principalAmount,
  outstandingBalance) and a link to the template-variable documentation

### Requirement: Text channel template config fields

Text channel templates SHALL store the following in their respective child tables:

**SmsConfig** (for `SMS`):

- `messageBody String` — message text; supports `{{firstName}}`, `{{lastName}}`,
  `{{principalAmount}}`, `{{outstandingBalance}}` placeholders
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
