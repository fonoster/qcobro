## ADDED Requirements

### Requirement: Agent templates namespace

The SDK `Client` SHALL expose an `agentTemplates` namespace whose methods map to the
apiserver's `agentTemplates` operations with friendly names and fully-typed inputs and
results, mirroring the `portfolios` namespace's shape.

#### Scenario: Methods are discoverable on the client

- **WHEN** a developer accesses `client.agentTemplates`
- **THEN** it provides `list`, `get`, `create`, and `sync` methods that each return a
  typed promise

### Requirement: List and read agent templates

`client.agentTemplates.list` SHALL return the active workspace's agent templates,
optionally filtered by `type` and optionally including archived ones.
`client.agentTemplates.get` SHALL return a single agent template by id within the active
workspace.

#### Scenario: List active agent templates

- **WHEN** `list()` is called in an authenticated, workspace-scoped client
- **THEN** the non-archived agent templates of the active workspace are returned

#### Scenario: Get an agent template by id

- **WHEN** `get({ id })` is called with an id in the active workspace
- **THEN** that agent template (with its type-specific config) is returned

### Requirement: Create an agent template

`client.agentTemplates.create` SHALL create an agent template in the active workspace,
validating its input against the shared `@qcobro/common` discriminated-union schema
(`createAgentTemplateSchema`) so each channel type's required fields are enforced
client-side before any request is sent.

#### Scenario: Create a VOICE_AI agent template

- **WHEN** `create({ type: "VOICE_AI", name, voice, systemPrompt, language })` is called
  with valid input
- **THEN** a new agent template is created in the active workspace and returned

#### Scenario: Invalid create input is rejected before the request

- **WHEN** `create(...)` is called with input missing a type-required field (e.g. a
  `VOICE_AI` template with no `voice`)
- **THEN** the call rejects with a structured validation error and no request is sent to
  the server

### Requirement: Re-sync an agent template

`client.agentTemplates.sync` SHALL manually re-attempt the Fonoster sync for a voice
agent template by id, returning the template with its updated `fonosterAppRef` and sync
outcome.

#### Scenario: Re-sync a previously unsynced template

- **WHEN** `sync({ id })` is called for a template whose prior Fonoster sync failed
- **THEN** the server re-attempts the sync and the returned template reflects the new
  outcome (`fonosterAppRef` populated on success)
