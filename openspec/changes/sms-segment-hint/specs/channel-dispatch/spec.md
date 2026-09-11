## MODIFIED Requirements

### Requirement: Channel dispatch functions are provider-injected triggers

The system SHALL provide a `dispatchOutreach` function that takes a resolved agent template
(with its channel config), a customer account, and the owning portfolio, and dispatches a
real outreach by routing on the template's channel type:

- `VOICE_AI` and `VOICE_PRERECORDED` → an outbound voice call via the injected
  `OutboundCallClient` (Fonoster).
- `SMS` → a message via the injected `SmsClient` (Twilio).

Each dispatch SHALL render the body (per the templating requirement), select a sending
number, call the injected provider client, and return a `DispatchResult`
(`{ channel, providerRef, from, to, renderedBody }`). Dispatch functions SHALL NOT write to
the database — persistence is the caller's responsibility — so the same functions serve both
the manual flow and the campaigns engine. Provider clients SHALL be injected so unit tests
run with stubs and no live calls.

For `SMS`, when the template has opted into GSM-7 normalization (see `agent-templates`), the
dispatch SHALL apply that substitution **after** rendering and before sending, and the
`renderedBody` it returns SHALL be the normalized text. Both dispatch paths — the campaigns
engine and the manual flow — SHALL honour the option, so the text recorded on the gestión is
always what the account holder received.

For `VOICE_AI`, the dispatch SHALL additionally forward the rendered account context to the
provider as string call metadata, restricted to an explicit allow-list of account facts, so
the agent can answer basic questions mid-call.

#### Scenario: SMS dispatch sends via the SMS client

- **WHEN** `dispatchOutreach` runs for an `SMS` template
- **THEN** the injected `SmsClient` sends the rendered `messageBody` from a selected number
  to the account's phone
- **AND** the returned `DispatchResult` has `channel: SMS` and the provider message ref

#### Scenario: Normalization applies to substituted values, not just the template

- **GIVEN** an `SMS` template that has opted into GSM-7 normalization, whose own text is
  entirely within the 7-bit alphabet
- **WHEN** a placeholder renders to a value that is not — an accented account holder's name
- **THEN** the substitution still reaches it, because normalization runs after rendering
- **AND** the `renderedBody` recorded for the gestión is the text that was sent

#### Scenario: Dispatch fails clearly when the channel is not configured

- **WHEN** a voice dispatch runs but no Fonoster app ref exists (or no sending numbers are
  configured), or an SMS dispatch runs with no Twilio configuration
- **THEN** dispatch fails with a `DispatchError` whose `kind` is `SYSTEM_ERROR`
- **AND** no partial outreach is attempted
