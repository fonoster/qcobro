## MODIFIED Requirements

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

- `templateId String` — the Meta template id the operator enters; QCobro fetches the template from
  the workspace's WABA to resolve and preview it
- `templateName String` — WhatsApp pre-approved template name, resolved from the entered template id
- `messageBody String` — the template body fetched from Meta (the named `{{vars}}` sent as Meta
  named template parameters). This is a **read-only cached preview**, not operator-authored text.
- `systemPrompt String` — the AI agent's behavior for the conversation after the customer replies
  (mirrors `EmailConfig`; a `WHATSAPP` agent is smart, not one-shot)
- `maxReplies Int` — maximum automated agent replies per gestión (mirrors `EmailConfig`)

Unlike `SmsConfig`/`EmailConfig`, the WHATSAPP **opener body is not editable** in QCobro: the
template is owned and approved in Meta Business Manager. The agent-template modal instead takes a
Meta **template id**, fetches the template from the workspace's WABA, and renders its body
read-only. The `systemPrompt` and `maxReplies` ARE operator-authored, exactly like the email
agent. The Meta template-send language is **not** stored on the config — it is sourced from the
workspace's WhatsApp integration (`WhatsAppIntegration.defaultLanguage`; see the
`workspace-integrations` delta); `WhatsAppConfig` carries no `language` field.

#### Scenario: Message body supports account placeholders

- **WHEN** the engine dispatches an SMS using a template with `{{firstName}}` in the body
- **THEN** the placeholder is replaced with the account holder's first name before sending

#### Scenario: WhatsApp template is fetched by id and previewed read-only

- **WHEN** an operator creates a `WHATSAPP` agent template and enters a Meta template id
- **THEN** QCobro fetches that template from the workspace's WABA and renders its body read-only in
  the modal as a preview
- **AND** stores the resolved `templateName` and the fetched body as `messageBody`
- **AND** the operator cannot edit the body text

#### Scenario: WhatsApp template requires a configured workspace integration

- **WHEN** an operator opens the `WHATSAPP` agent-template modal in a workspace with no WhatsApp
  integration
- **THEN** the template cannot be created, because fetching the template body requires WABA
  credentials

#### Scenario: WhatsApp agent stores conversation behavior

- **WHEN** an operator creates a `WHATSAPP` agent template
- **THEN** the editable `systemPrompt` and `maxReplies` are stored alongside the read-only
  template fields
- **AND** they drive the AI agent's replies after the customer responds, exactly like the `EMAIL` agent
