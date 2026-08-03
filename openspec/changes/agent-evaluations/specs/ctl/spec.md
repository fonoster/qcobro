## MODIFIED Requirements

### Requirement: Agent template commands

`qcobro agents:create` SHALL wrap `client.agentTemplates.create`, accepting the agent
type and its type-specific fields as flags. `qcobro agents:sync` SHALL wrap
`client.agentTemplates.sync` for a given template id, reporting whether the template's
configuration re-synced successfully with Fonoster (its `fonosterAppRef` and sync
outcome) — this validates configuration/sync status, not conversation behavior, and its
help text SHALL say so. `qcobro agents:eval` SHALL wrap `client.agentEvaluations.evaluate`,
accepting either an existing template id plus a scenarios file or a standalone YAML eval
template (agent definition plus embedded scenarios), streaming per-turn results to the
terminal as they arrive and printing a final pass/fail summary; it SHALL exit non-zero when
the overall verdict fails. `qcobro agents:preview` SHALL wrap `client.agentTemplates.preview`
for `SMS`/`VOICE_PRERECORDED` templates, printing the rendered message/script for a given
account.

#### Scenario: Creating a VOICE_AI agent template

- **WHEN** a developer runs `agents:create --type VOICE_AI --name <name> --voice <voice>
--system-prompt <prompt> --language <lang>`
- **THEN** the CLI calls `client.agentTemplates.create` with a `VOICE_AI` payload and
  prints the created template

#### Scenario: Re-syncing an agent template's Fonoster configuration

- **WHEN** a developer runs `agents:sync <templateId>`
- **THEN** the CLI calls `client.agentTemplates.sync({ id: templateId })` and prints the
  resulting sync status (synced / not synced) and `fonosterAppRef` when present

#### Scenario: Evaluating an existing template against a scenarios file

- **WHEN** a developer runs `agents:eval --template-id <id> --scenarios <scenarios.yaml>`
- **THEN** the CLI calls `client.agentEvaluations.evaluate({ agentTemplateId: id, scenarios
})`, prints each turn result as it streams in, and prints a final pass/fail summary

#### Scenario: Evaluating a standalone YAML eval template before creation

- **WHEN** a developer runs `agents:eval --file <evalTemplate.yaml>` where the file contains
  an agent definition with an embedded `scenarios` array
- **THEN** the CLI calls `client.agentEvaluations.evaluate({ yaml })` with the file's raw
  contents, without creating any `AgentTemplate`, and streams results the same way

#### Scenario: Failed evaluation exits non-zero

- **WHEN** an `agents:eval` run's terminal summary reports an overall failing verdict
- **THEN** the CLI process exits with a non-zero status code

#### Scenario: Previewing a static template's rendered output

- **WHEN** a developer runs `agents:preview --template-id <id> --account <account.json>` for
  an `SMS` template
- **THEN** the CLI calls `client.agentTemplates.preview` and prints the rendered message body
