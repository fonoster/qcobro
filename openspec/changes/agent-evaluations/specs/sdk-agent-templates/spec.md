## ADDED Requirements

### Requirement: Preview a template's rendered output

`client.agentTemplates.preview` SHALL synchronously render an `SMS` or `VOICE_PRERECORDED`
agent template's message body or script against a caller-supplied sample account context and
return the rendered text. It SHALL accept either `{ agentTemplateId, account }` for an existing
template, or `{ yaml, account }` for an agent defined in YAML prior to creation (parsed and
validated against `createAgentTemplateSchema`, exactly as `agentEvaluations.evaluate` does for
its YAML target). `preview` SHALL NOT stream, SHALL NOT invoke Fonoster or any conversational
scoring, and SHALL NOT create any `AgentTemplate` row, gestión, or other workspace side effect.

#### Scenario: Preview an existing SMS template

- **WHEN** `preview({ agentTemplateId, account })` is called for an existing `SMS` template
  whose `messageBody` contains `{{firstName}}`
- **THEN** the call returns the rendered message body with the placeholder replaced from the
  supplied account context

#### Scenario: Preview a YAML-defined VOICE_PRERECORDED template before creation

- **WHEN** `preview({ yaml, account })` is called with a valid `VOICE_PRERECORDED` agent
  definition in YAML
- **THEN** the call returns the rendered script text for the supplied account context
- **AND** no `AgentTemplate` row is created

#### Scenario: Preview is rejected for a conversational channel type

- **WHEN** `preview` is called with an `agentTemplateId` or `yaml` definition whose type is
  `VOICE_AI`, `EMAIL`, or `WHATSAPP`
- **THEN** the call rejects with a structured validation error directing the caller to
  `agentEvaluations.evaluate` instead

#### Scenario: Invalid preview input is rejected before the request

- **WHEN** `preview(...)` is called with a `yaml` definition missing a type-required field
- **THEN** the call rejects with a structured validation error and no request is sent to the
  server
