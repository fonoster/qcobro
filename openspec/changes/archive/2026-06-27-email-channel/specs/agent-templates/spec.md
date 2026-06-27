## ADDED Requirements

### Requirement: EMAIL agent autopilot configuration

An EMAIL agent template SHALL carry a `systemPrompt` (the autopilot's decision brain) and an
optional per-agent reply cap (`maxReplies`), in addition to the existing `subject`,
`messageBody` (the initial collection notice), `fromName`, and `fromEmail`. The
`systemPrompt` SHALL be required when creating an EMAIL agent. When `maxReplies` is omitted,
the effective cap SHALL fall back to the deployment default from configuration.

#### Scenario: Creating an EMAIL agent requires a system prompt

- **WHEN** an EMAIL agent template is created without a `systemPrompt`
- **THEN** validation fails with a structured error and no template is created

#### Scenario: Reply cap falls back to the deployment default

- **WHEN** an EMAIL agent is created without `maxReplies`
- **THEN** its effective reply cap is the deployment default from the `resend` config
