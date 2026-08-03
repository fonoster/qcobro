## ADDED Requirements

### Requirement: Agent evaluations namespace

The SDK `Client` SHALL expose an `agentEvaluations` namespace whose `evaluate` method starts
an evaluation run for a `VOICE_AI`, `EMAIL`, or `WHATSAPP` agent and returns an async stream
of evaluation events. This namespace is distinct from and unrelated to the `engine-scorecard`
capability's `evaluate(events, parameters)` function — that function judges dispatch/engine
behavior across many accounts over time; this namespace judges one agent's conversation logic
against scripted scenarios.

#### Scenario: Method is discoverable on the client

- **WHEN** a developer accesses `client.agentEvaluations`
- **THEN** it provides an `evaluate` method that returns an async stream of evaluation events

### Requirement: An eval template is a single document — agent definition plus its own scenarios

An eval template SHALL bundle an agent definition and the scenarios that exercise it in one
document: the same fields `createAgentTemplateSchema` validates for `agentTemplates.create`,
plus a `scenarios` array. Each scenario SHALL carry an account context (the same shape
`buildOutreachContext` produces from a `PortfolioAccountRecord`) and an ordered list of turns.
A turn SHALL carry the simulated customer input and MAY carry an `expected` assertion; a turn
with no `expected` still executes and streams a result, it simply has nothing to grade.

#### Scenario: A YAML eval template embeds both the agent and its scenarios

- **WHEN** a developer authors a YAML document with `EMAIL` agent fields (`subject`,
  `messageBody`, `systemPrompt`, ...) and a `scenarios` array of scripted turns
- **THEN** `evaluate({ yaml })` parses the whole document as one unit — the agent definition
  and its scenarios travel together, with no separate scenario input required

#### Scenario: A turn with no expectation still streams a result

- **WHEN** a scenario's turn carries a customer input but no `expected` field
- **THEN** the run still executes that turn and streams its result, with no pass/fail graded
  for it

### Requirement: Evaluate an existing agent template by id

`client.agentEvaluations.evaluate` SHALL accept `{ agentTemplateId, scenarios }` to evaluate an
already-created `VOICE_AI`, `EMAIL`, or `WHATSAPP` agent template within the active workspace
against caller-supplied scenarios, validated client-side before any request is sent. Unlike the
YAML target, an existing template's row carries no stored scenarios — the caller supplies them
at call time.

#### Scenario: Evaluate an existing VOICE_AI template

- **WHEN** `evaluate({ agentTemplateId, scenarios })` is called for an existing `VOICE_AI`
  template in the active workspace
- **THEN** the apiserver runs the evaluation against that template's configuration and streams
  events until a terminal summary event

#### Scenario: Unknown or cross-workspace template id is rejected

- **WHEN** `evaluate({ agentTemplateId, scenarios })` is called with an id that does not exist,
  or exists in a different workspace
- **THEN** the call rejects with a structured error and no evaluation run starts

### Requirement: Evaluate an agent defined in YAML before creation

`client.agentEvaluations.evaluate` SHALL accept `{ yaml }` to evaluate a `VOICE_AI`, `EMAIL`,
or `WHATSAPP` agent definition — together with its embedded scenarios — that has not been
created yet. The YAML's agent fields SHALL be parsed and validated against the same
`createAgentTemplateSchema` discriminated union that `agentTemplates.create` validates against,
then held as an ephemeral, non-persisted agent for the duration of the run. No `AgentTemplate`
row, Fonoster application, or other workspace side effect SHALL be created by an evaluation
run — this holds for every channel, including `VOICE_AI`: evaluating a Fonoster-backed agent
requires no application to exist and no prior sync, ephemeral or otherwise.

#### Scenario: Evaluate a YAML-defined EMAIL agent without creating it

- **WHEN** `evaluate({ yaml })` is called with a valid `EMAIL` agent definition and its
  embedded scenarios
- **THEN** the apiserver runs the evaluation against an ephemeral in-memory agent built from
  that definition and streams events
- **AND** no `AgentTemplate` row is created in the workspace

#### Scenario: Evaluate a YAML-defined VOICE_AI agent with nothing synced

- **WHEN** `evaluate({ yaml })` is called with a valid `VOICE_AI` agent definition that has
  never been synced to Fonoster (no `fonosterAppRef` exists anywhere for it)
- **THEN** the evaluation still runs, because the underlying Fonoster call requires only the
  agent's intelligence configuration, not a previously created application

#### Scenario: Invalid YAML definition is rejected before the request

- **WHEN** `evaluate({ yaml })` is called with a YAML document that fails validation against
  `createAgentTemplateSchema` (e.g. an `EMAIL` definition missing `systemPrompt`)
- **THEN** the call rejects with a structured validation error and no request is sent to the
  server

### Requirement: Evaluation events stream incrementally

Evaluation events SHALL stream from the apiserver to the SDK over the existing WebSocket-based
tRPC subscription transport (the `realtime-streaming` capability), incrementally as the run
progresses, rather than as a single terminal response. Each run SHALL emit at least one
per-turn event before its terminal summary event, except for a run that fails before any turn
executes. The apiserver SHALL compute and emit the terminal summary itself, aggregating every
scenario's (and, where applicable, every turn's) result into one overall verdict — regardless
of whether the backing provider for that channel natively produces a single run-level summary.

#### Scenario: Events arrive before the run completes

- **WHEN** a multi-turn evaluation run is in progress
- **THEN** the caller observes per-turn evaluation events on the stream before the run's
  terminal summary event arrives

#### Scenario: Terminal summary event concludes the stream

- **WHEN** an evaluation run finishes, successfully or not
- **THEN** the stream emits exactly one terminal summary event with an overall pass/fail
  verdict, and the stream then closes

#### Scenario: Multi-scenario run yields one aggregated summary

- **WHEN** an evaluation run covers more than one scenario
- **THEN** the terminal summary event's verdict reflects all scenarios together, even though
  the backing provider for that channel reports pass/fail per scenario rather than per run

### Requirement: VOICE_AI evaluation reuses Fonoster AUTOPILOT eval machinery

For a `VOICE_AI` target, the apiserver SHALL delegate the evaluation run to Fonoster's existing
AUTOPILOT evaluation machinery via `@fonoster/sdk`'s `Applications.evaluateIntelligence`,
translating each scenario's account context and turns into Fonoster's scenario/conversation
shape and relaying its per-turn step results and per-scenario summaries as this capability's
evaluation events, rather than re-implementing conversational scoring. A turn's `expected.text`
SHALL map to Fonoster's `EXACT`/`SIMILAR` text expectation and `expected.tools` (e.g. asserting
a `hangup` invocation) SHALL map to Fonoster's tool-call expectation.

#### Scenario: VOICE_AI run relays Fonoster's scored turns

- **WHEN** a `VOICE_AI` agent is evaluated with a scenario whose turns carry `expected.text`
  assertions
- **THEN** each turn's result streamed to the caller reflects the corresponding Fonoster
  step result, including whether it passed

### Requirement: EMAIL and WHATSAPP evaluation drives the autopilot decision loop against a scripted reply

For an `EMAIL` or `WHATSAPP` target, each scenario's ordered turns SHALL be run one at a time
through the existing autopilot decision loop (`reply` / `ignore` / `resolve` / `escalate`)
against the accumulated thread and account context, exactly as it runs on a real correlated
inbound reply. Each turn's `expected`, when present, SHALL be `{ action?, outcome? }` — the
EMAIL/WHATSAPP analog of VOICE_AI's `expected.tools` — asserting the decision action and/or
captured outcome the turn should produce; a turn's result SHALL report `passed: false` when the
actual action or outcome differs from what was expected. Reply-cap behavior SHALL match the
corresponding live channel exactly: once the scripted run's agent reply count reaches the cap,
no further turn SHALL produce a `reply` action.

#### Scenario: A scripted reply that states intent to pay is captured

- **WHEN** an `EMAIL` evaluation's scenario includes a turn whose input states intent to pay
  and whose `expected` is `{ outcome: "PAYMENT_PROMISE" }`
- **THEN** the turn's result reports the decision `reply` with a `PAYMENT_PROMISE` outcome, a
  captured `PaymentPromise`, and `passed: true`

#### Scenario: An unmet expectation is reported as failed, not silently accepted

- **WHEN** a turn's `expected` is `{ action: "resolve" }` but the autopilot's actual decision is
  `escalate`
- **THEN** the turn's result reports the actual action `escalate` and `passed: false`

#### Scenario: A scripted reply after the cap does not produce a reply action

- **WHEN** a scenario's turns exceed the agent's configured `maxReplies`
- **THEN** the turn results for turns beyond the cap report `ignore`, `resolve`, or `escalate`
  — never `reply`

#### Scenario: WHATSAPP evaluation uses the identical mechanism to EMAIL

- **WHEN** a `WHATSAPP` agent is evaluated with a scripted scenario
- **THEN** the same autopilot decision-loop mechanism used for `EMAIL` evaluation runs against
  it, honoring its `systemPrompt` and `maxReplies`

### Requirement: Evaluation runs have no live outreach side effects

An evaluation run, whether against an existing template or a YAML definition, SHALL NOT
dispatch any real outreach (no call placed, no message sent) and SHALL NOT write any
`AccountContactLog` (gestión) or persisted `PaymentPromise` row. Any `PaymentPromise` reported
in an evaluation event SHALL be a run-scoped result returned to the caller, not a persisted
workspace record.

#### Scenario: Evaluating an existing template does not dispatch real outreach

- **WHEN** an operator evaluates an existing `VOICE_AI` template that is also used by an active
  campaign
- **THEN** no call is placed, no gestión is created, and the campaign's real dispatch activity
  is unaffected by the evaluation run

#### Scenario: Captured promise during evaluation is not persisted

- **WHEN** a scripted EMAIL evaluation's turn captures a `PaymentPromise`-shaped outcome
- **THEN** the outcome appears only in the returned evaluation event, and no `PaymentPromise`
  row is written to the database
