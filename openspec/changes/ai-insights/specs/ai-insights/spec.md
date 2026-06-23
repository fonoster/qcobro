## ADDED Requirements

### Requirement: Transcript-based AI analysis

The system SHALL generate a gestión's structured AI analysis — `aiSummary`, `aiSentiment`
(one of `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `HOSTILE`), `aiDebtReason`, `aiResult`,
`aiNextStep` — from the gestión's conversation transcript using a configured LLM, and SHALL
persist the result onto the gestión. Analysis SHALL run **only** for gestiones that carry a
non-empty transcript; gestiones without a transcript SHALL never be sent to the LLM.

#### Scenario: A gestión with a transcript is analyzed

- **WHEN** AI insights are enabled and analysis runs for a gestión that has a transcript
- **THEN** the transcript is sent to the configured LLM and the returned `aiSummary`,
  `aiSentiment`, `aiDebtReason`, `aiResult`, and `aiNextStep` are persisted onto the gestión

#### Scenario: A gestión without a transcript is never analyzed

- **WHEN** a gestión has no transcript (e.g. an SMS, email, or pre-recorded gestión)
- **THEN** no LLM call is made for it and its AI fields are left unset

#### Scenario: A malformed or failed analysis leaves the gestión unanalyzed

- **WHEN** the LLM is unavailable or returns output that does not match the expected schema
- **THEN** the gestión's AI fields remain unset (no partial or invalid data is persisted)
  and analysis may be attempted again later

### Requirement: Analysis output is in the call's language

The generated analysis text SHALL be written in the language of the conversation (derived
from the account's preferred language or the agent's language), so the insight is legible to
the operator working that account. Sentiment SHALL always be one of the fixed enum values
regardless of language.

#### Scenario: Spanish call yields Spanish analysis

- **WHEN** a Voz IA call was conducted in Spanish and is analyzed
- **THEN** `aiSummary`, `aiDebtReason`, `aiResult`, and `aiNextStep` are written in Spanish
- **AND** `aiSentiment` is one of `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `HOSTILE`

### Requirement: AI insights are configured in qcobro.json

The deployment SHALL configure AI insights through an optional `ai` section in `qcobro.json`
with: `enabled`, `provider` (`mock` | `google` | `openai` | `anthropic`), `apiKey`, `model`
(default a Google `gemini-2.5-flash`-class model), `temperature`, `maxTokens`, and
`generation` (`onDemand` | `onIngestion`). Providers are reached over their REST APIs (no
SDK dependency); `mock` is an offline provider that synthesizes a deterministic analysis
from the transcript (no key, network, or cost) for local dev, demos, and tests. When the
`ai` section is absent or `enabled` is false, the system SHALL NOT call any LLM and SHALL
leave AI fields unset.

#### Scenario: AI insights disabled by default

- **WHEN** `qcobro.json` has no `ai` section (or `ai.enabled` is false)
- **THEN** no transcript is ever sent to an LLM and no AI fields are generated

#### Scenario: Provider and model are taken from config

- **WHEN** AI insights are enabled with a provider, apiKey, and model
- **THEN** analysis uses that provider/model, and an invalid model for the provider is
  rejected at configuration load

### Requirement: Configurable generation timing with caching

The system SHALL support two generation modes. In `onDemand` (the default), analysis is
generated the first time the gestión detail is opened for a gestión that has a transcript and
no analysis yet, and the result is persisted so it is not regenerated on subsequent opens. In
`onIngestion`, analysis is generated when the conversation transcript is first stored.

#### Scenario: On-demand generates once and caches

- **WHEN** generation is `onDemand` and an operator opens a transcript-bearing gestión with
  no analysis yet
- **THEN** the analysis is generated and persisted
- **AND** opening that gestión again returns the persisted analysis without another LLM call

#### Scenario: On-ingestion generates when the transcript arrives

- **WHEN** generation is `onIngestion` and a conversation transcript is stored for a gestión
- **THEN** the analysis is generated and persisted at that time

### Requirement: Analysis is advisory and never auto-acts

The generated analysis SHALL NOT change the gestión's `outcome` and SHALL NOT create or
modify `Objective` records; it only fills the AI fields for the operator to read.

#### Scenario: Analysis does not alter outcome or objectives

- **WHEN** an analysis is generated for a gestión
- **THEN** the gestión's `outcome` is unchanged and no `Objective` is created or modified as
  a side effect of the analysis
