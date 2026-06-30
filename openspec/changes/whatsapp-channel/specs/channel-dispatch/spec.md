## ADDED Requirements

### Requirement: WHATSAPP channel dispatch

The dispatch layer SHALL support a `WHATSAPP` channel alongside the voice, SMS, and EMAIL
channels, and `DispatchChannel` SHALL include `WHATSAPP`. A WHATSAPP dispatch SHALL render the
agent template's `messageBody` Handlebars `{{vars}}` against the account context and send them as
named template parameters through an injected `WhatsAppClient`, returning a `DispatchResult` whose
`providerRef` is the Meta message id. Unlike the voice and SMS clients — which are injected once at
boot from deployment-global configuration — the `WhatsAppClient` SHALL be resolved per dispatch
from the owning workspace's stored integration credentials and passed in by the caller, so
`dispatchOutreach` remains pure and writes nothing to the database.

#### Scenario: WHATSAPP dispatch sends through the resolved client

- **WHEN** `dispatchOutreach` runs for a `WHATSAPP` template with a `WhatsAppClient` resolved from
  the workspace's integration
- **THEN** the rendered named parameters are sent via that client under the configured
  `templateName`
- **AND** the returned `DispatchResult` has `channel: WHATSAPP` and the provider message id

#### Scenario: WHATSAPP dispatch fails clearly when the integration is missing

- **WHEN** a WHATSAPP dispatch runs for a workspace with no WhatsApp integration or no resolved
  sender number
- **THEN** dispatch fails with a structured error
- **AND** no partial outreach is attempted
