# workspace-integrations Specification

## Purpose

TBD — created by syncing change whatsapp-channel. Update Purpose after archive.

## Requirements

### Requirement: Per-workspace WhatsApp integration with encrypted credentials

The system SHALL allow an operator to configure a WhatsApp Business Account (WABA) per workspace,
storing the `wabaId`, an access token, and a webhook `verifyToken`. The access token SHALL be
encrypted at rest using a deployment-owned key from `qcobro.json` and SHALL be decrypted only when
building a provider client; it SHALL NOT be returned to the client or written to logs in plaintext.
A workspace SHALL have at most one WhatsApp integration. The integration SHALL be modeled at the
WABA level so it can carry additional capabilities (e.g. calling) in the future without a remodel.

#### Scenario: Operator connects a WABA

- **WHEN** an operator submits valid `wabaId`, access token, and `verifyToken` for the active
  workspace
- **THEN** the integration is stored with the access token encrypted at rest
- **AND** reads of the integration never expose the access token in plaintext

#### Scenario: Encryption key absent disables the integration area

- **WHEN** no WhatsApp encryption key is configured in `qcobro.json`
- **THEN** the WhatsApp integration area is unavailable rather than crashing boot

### Requirement: WhatsApp sender numbers with capabilities and cached quality

A WhatsApp integration SHALL own one or more sender numbers, each with a Meta `phoneNumberId`, an
E.164 `displayNumber`, an operator `label`, a cached `qualityRating`, and a `capabilities` flag set
(`messaging` enabled in this version; `calling` reserved for the future). A sender number does NOT
carry a language — the Meta template-send language is a workspace-level setting (see "Workspace
template-send language"). `phoneNumberId` SHALL be unique across the deployment so inbound webhook
events resolve to exactly one workspace and sender.

#### Scenario: Operator adds a sender number

- **WHEN** an operator adds a sender number with a `phoneNumberId`, `displayNumber`, and `label`
  to the workspace's WhatsApp integration
- **THEN** the number is stored with `capabilities.messaging` enabled
- **AND** it becomes selectable as a campaign sender

#### Scenario: Duplicate phoneNumberId is rejected

- **WHEN** an operator adds a sender number whose `phoneNumberId` already exists in the deployment
- **THEN** the system rejects the request with a validation error

### Requirement: Workspace template-send language

The Meta template-send `languageCode` SHALL be sourced from the workspace's WhatsApp integration
(`WhatsAppIntegration.defaultLanguage`), which keeps all WhatsApp config together and is per-workspace
(one integration per workspace). It SHALL NOT come from `WorkspaceSettings`, the agent template, the
sender number, or the account. Both the read-only template preview in the agent-template modal and the
outbound send SHALL use this language. `PortfolioAccount.preferredLanguage` SHALL NOT be used for
WhatsApp language selection.

#### Scenario: Outbound WhatsApp send uses the integration's language

- **WHEN** the engine dispatches a WhatsApp template for a workspace whose integration
  `defaultLanguage` is `es_DO`
- **THEN** the Meta template is sent under language code `es_DO`
- **AND** the value is read from the workspace's WhatsApp integration, not from the agent template or
  the account
