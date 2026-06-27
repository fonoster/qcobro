## ADDED Requirements

### Requirement: Outbound email dispatch via Resend

The system SHALL send EMAIL outreach through an injected email provider client (Resend),
rendering the agent's subject and message body against the account context before sending.
Each send SHALL set a unique per-attempt reply-to address carrying an opaque token, and the
dispatch SHALL return that token as the gestión `providerRef` for later correlation. The
provider client SHALL be injected so tests use an emulator and no live email is sent.

#### Scenario: Collection notice is sent

- **WHEN** the engine dispatches an EMAIL campaign for an eligible account
- **THEN** the rendered subject and body are sent via the provider from the agent's
  `fromName`/`fromEmail`
- **AND** a unique reply-to token is set and stored as the gestión `providerRef`
- **AND** exactly one gestión is recorded for the attempt

#### Scenario: Provider failure consumes the attempt

- **WHEN** the provider send fails after the attempt is reserved
- **THEN** the attempt stays consumed (at-most-once) and no gestión outcome is recorded
- **AND** the failure reason is surfaced in logs, not silently swallowed

### Requirement: Inbound reply ingestion and correlation

The system SHALL expose an authenticated inbound webhook (`POST /api/email/inbound`) that
receives provider reply events. It SHALL verify the provider signature before processing,
reject unverified requests, and correlate each reply to its originating gestión by the
reply-to token (`providerRef`), falling back to `References`/`In-Reply-To`. A correlated
reply SHALL be appended to the gestión's email thread (direction, sender, timestamp, body,
message id). A reply that cannot be correlated SHALL be rejected without mutating data.

#### Scenario: A reply is threaded onto its gestión

- **WHEN** a verified inbound reply arrives carrying a known reply-to token
- **THEN** it is appended to that gestión's email thread
- **AND** the gestión's outcome is (re)evaluated from the updated thread

#### Scenario: Unverified or uncorrelated inbound is rejected

- **WHEN** an inbound request fails signature verification, or carries no known token and no
  matching `References`/`In-Reply-To`
- **THEN** the request is rejected and no gestión is modified

#### Scenario: Auto-replies do not drive the conversation

- **WHEN** an inbound message carries `Auto-Submitted` (not `no`) or `Precedence: bulk`
- **THEN** it is treated as non-actionable (`ignore`) and does not count against the reply cap

### Requirement: EMAIL autopilot decision loop

On each correlated inbound reply, the system SHALL run the EMAIL agent as an autopilot: a
decision step over the thread and account context, governed by the agent `systemPrompt`,
producing a structured action — `reply`, `ignore`, `resolve`, or `escalate`. When the
action is `reply`, the system SHALL generate a reply, send it via the provider, and append
it to the thread. When the action is `resolve` or `escalate`, the system SHALL stop
auto-replying. Outcome and `Objective` capture from the thread SHALL reuse the existing
insight path: a real outcome SHALL NOT be downgraded, and re-delivered webhooks SHALL NOT
create duplicate `Objective`s.

#### Scenario: A promise is captured and acknowledged

- **WHEN** the customer's reply states an intent to pay
- **THEN** the decision is `reply` with a `PAYMENT_PROMISE` outcome and a promise `Objective`
- **AND** an acknowledgement reply is sent and threaded
- **AND** re-delivery of the same inbound event does not create a second `Objective`

#### Scenario: Resolve stops the conversation

- **WHEN** the decision is `resolve` (e.g. the debt is settled or intent is met)
- **THEN** the outcome/suppression is set and no further auto-reply is sent

### Requirement: Reply cap per collection attempt

The system SHALL bound the number of autopilot replies per collection attempt (per gestión)
to `min(agent.maxReplies, deployment default)`. Once the agent reply count on a thread
reaches the cap, the decision step SHALL NOT produce a `reply` action — only `ignore`,
`resolve`, or `escalate`.

#### Scenario: Cap halts further auto-replies

- **WHEN** the agent has already sent the maximum number of replies on a thread
- **AND** a further inbound reply arrives
- **THEN** no auto-reply is sent (the decision is constrained to ignore/resolve/escalate)

### Requirement: Resend configuration

The system SHALL read a `resend` block from `qcobro.json` providing the API key, sending
domain/from address, the inbound reply domain, the inbound webhook signing secret, per-
minute send pacing, and a default reply cap. EMAIL dispatch and inbound SHALL be inert when
the block is absent (the engine reports EMAIL as not configured rather than erroring).

#### Scenario: Email is inert without configuration

- **WHEN** the `resend` block is absent and an EMAIL campaign is active
- **THEN** the engine skips it as not-configured and sends nothing
