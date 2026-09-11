## MODIFIED Requirements

### Requirement: Text channel template config fields

Text channel templates SHALL store the following in their respective child tables:

**SmsConfig** (for `SMS`):

- `messageBody String` — message text; supports `{{firstName}}`, `{{lastName}}`,
  `{{principalAmount}}`, `{{outstandingBalance}}` placeholders
- `senderId String?` — optional sender identifier
- `normalizeGsm7 Boolean` — when set, characters outside the GSM 7-bit alphabet that have an
  unambiguous ASCII equivalent are substituted before the message is sent. Defaults to off,
  because it changes the text the account holder reads.

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
workspace's WhatsApp integration (`WhatsAppIntegration.defaultLanguage`; see
`workspace-integrations`); `WhatsAppConfig` carries no `language` field.

#### Scenario: Message body supports account placeholders

- **WHEN** the engine dispatches an SMS using a template with `{{firstName}}` in the body
- **THEN** the placeholder is replaced with the account holder's first name before sending

#### Scenario: WhatsApp named parameters use Meta's snake_case format

- **GIVEN** Meta rejects named template parameters that are not lowercase snake_case (e.g. it
  accepts `{{first_name}}` but not `{{firstName}}`)
- **WHEN** the engine dispatches a WhatsApp template whose body contains a snake_case
  placeholder, e.g. `{{first_name}}` or `{{outstanding_balance}}`
- **THEN** the engine maps it to the camelCase account field of the same name (`firstName`,
  `outstandingBalance`) and sends the resolved value as that literal snake_case named
  parameter
- **AND** the documented variable reference lists each variable's WhatsApp (snake_case) name
  alongside its camelCase name used by every other channel

## ADDED Requirements

### Requirement: SMS sending-cost estimate while authoring

While an operator is authoring or editing an SMS template, the console SHALL show a live
estimate of how many messages the body will be sent as, alongside its character count. The
estimate SHALL update as the body is typed and SHALL appear in both the create and the edit
form.

This exists because an SMS is split into billable parts by a rule an operator cannot apply by
eye: it depends on which characters the text contains, not only how many. A single character
outside the GSM 7-bit alphabet forces the whole message into 16-bit encoding and cuts the
per-part budget from 160 characters to 70. Operators today discover this only from the bill.

The estimate SHALL be computed from **rendered** text — the body with its `{{placeholders}}`
substituted from representative sample values — not from the raw template. A substituted value
is the most common reason a message changes encoding, and the raw template's placeholder text
bears no relation in length to what replaces it. The estimate SHALL be presented as
approximate, since a real account's values differ from the sample's.

Where a character is what changed the encoding, the console SHALL be able to say which one.
The estimate SHALL NOT name the encoding standard or any SMS provider as product language, and
SHALL remain a single line — not a panel, breakdown, or separate view.

#### Scenario: Operator sees the cost of a long message

- **WHEN** an operator types an SMS body past the single-message budget
- **THEN** the estimate updates to show more than one message

#### Scenario: A substituted value changes the estimate

- **GIVEN** a body whose placeholders render to a value containing a character outside the
  7-bit alphabet
- **WHEN** the operator views the estimate
- **THEN** it reflects the rendered text, so the reduced budget is visible while authoring
- **AND** the raw template's placeholder length does not distort the count

#### Scenario: A malformed template is not counted

- **WHEN** the body fails to render (e.g. it references an unknown helper)
- **THEN** the error marker the renderer produces is not counted as message content

### Requirement: Opt-in GSM-7 normalization for SMS

The system SHALL let an SMS template opt into substituting characters that cost the message its
7-bit encoding for their ASCII equivalents before sending. The substitution SHALL be limited to
characters that have an unambiguous equivalent and lose nothing a reader would notice;
characters already in the 7-bit alphabet SHALL be left untouched, and no substitution that
changes meaning (such as `ñ` to `n`) SHALL ever be applied.

Normalization SHALL be applied **after** placeholder rendering, so it reaches substituted
values and not only the template's own text. The message body recorded on the gestión SHALL be
the normalized text — what the account holder actually received.

The option SHALL default to off, SHALL be settable when creating and when editing a template,
and SHALL be reflected in the authoring estimate and in any preview of the message, so the
operator never sees text that differs from what will be sent.

A body MAY still require 16-bit encoding after normalization — a character with no ASCII
equivalent, such as an emoji, SHALL be left in place rather than removed from the operator's
copy.

#### Scenario: Enabling normalization lowers the cost

- **GIVEN** an SMS body that renders to text containing a character outside the 7-bit alphabet
  that has an ASCII equivalent
- **WHEN** the operator enables normalization
- **THEN** the authoring estimate falls to the 7-bit budget
- **AND** the dispatched message carries the substituted text

#### Scenario: Meaning is never altered to save cost

- **GIVEN** a body containing characters that are already in the 7-bit alphabet
- **WHEN** normalization is enabled
- **THEN** those characters are sent unchanged

#### Scenario: Normalization is off by default

- **WHEN** an operator creates an SMS template without choosing the option
- **THEN** messages are sent exactly as rendered
