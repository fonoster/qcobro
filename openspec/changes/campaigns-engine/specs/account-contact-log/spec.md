## MODIFIED Requirements

### Requirement: Gestión log triggers hot-path field updates

When an outreach attempt is made, the API server SHALL update `PortfolioAccount`
hot-path fields and `CampaignAccountState` — but the attempt **counter** updates are
split from the gestión write so the engine can enforce at-most-once.

- **Reserve (before the provider call):** the attempt is reserved in a transaction that
  increments `CampaignAccountState.attemptCount` and `attemptsToday`, sets
  `lastAttemptAt`, and bumps `PortfolioAccount.totalAttempts` and `lastContactedAt`. The
  provider call happens only after this transaction commits.
- **Record (on outcome):** writing/enriching the gestión applies outcome triggers
  (`suppressUntil`, `intentStatus`, `Objective`) and SHALL NOT increment the attempt
  counters again.

The manual flow uses the same reserve + record path, so a manual contact is counted and
logged identically to an engine attempt.

#### Scenario: Counters increment once, at reserve time

- **WHEN** an attempt is reserved for account A under campaign C
- **THEN** `CampaignAccountState.attemptCount`/`attemptsToday` increment by 1,
  `lastAttemptAt` is set, and `PortfolioAccount.totalAttempts`/`lastContactedAt` update
- **AND** the later gestión write for the same attempt does not increment them again

#### Scenario: Campaign-local `suppressUntil` set from Objective dueDate

- **WHEN** a gestión entry creates an Objective with a `dueDate`
- **AND** the campaign has a matching trigger configured
- **THEN** `CampaignAccountState.suppressUntil` is set to `dueDate`
  (falls back to `contactedAt + suppressDays` if no `dueDate` is present)

#### Scenario: Global `intentStatus` set on hard outcomes

- **WHEN** a gestión entry is written with outcome `RESOLVED` or `PAID`
- **THEN** `PortfolioAccount.intentStatus` is set to `INTENT_MET`
- **WHEN** outcome is `WRONG_NUMBER`
- **THEN** `PortfolioAccount.intentStatus` is set to `WRONG_NUMBER`
- **WHEN** outcome is `OPT_OUT`
- **THEN** `PortfolioAccount.intentStatus` is set to `OPT_OUT`
- **AND** in all cases, global suppression blocks the account across ALL campaigns

### Requirement: Gestión — contact log records every outreach attempt

A **Gestión** SHALL be the system record of a single outreach attempt against a
`PortfolioAccount`. There SHALL be exactly **one gestión per attempt**: it is written at
dispatch time with the provider ref stored in `channelData`, and the asynchronous outcome
callback **enriches the same entry** (correlated by provider ref) rather than creating a
second one. The gestión is the authoritative record of contact history, AI conversation
analysis, channel metadata, and resulting Objectives.

Operators SHALL NOT be able to edit or delete gestiones through the API; corrections are
expressed by writing a new entry referencing `correctedEntryId`. System enrichment of a
dispatch-time entry by its provider ref is permitted and is not an operator edit.

Each `AccountContactLog` entry SHALL capture: `portfolioAccountId`, `campaignId?`
(nullable for manual contacts), `agentType`, `contactedAt`, `durationSeconds?`,
`outcome`, `notes?`, `debtAmountSnapshot?`, the AI insight fields (`aiSummary`,
`aiSentiment`, `aiDebtReason`, `aiResult`, `aiNextStep`), `intentMetadata?`,
`channelData?` (including the provider ref), `correctedEntryId?`, and `createdAt`.

**ContactOutcome enum:**
`NO_ANSWER` · `PAYMENT_PROMISE` · `PARTIAL_PAYMENT_AGREED` · `CALLBACK_REQUESTED` ·
`RESOLVED` · `PAID` · `WRONG_NUMBER` · `OPT_OUT` · `REFUSED` · `OTHER`

#### Scenario: One gestión written at dispatch, enriched by callback

- **WHEN** the engine (or manual flow) successfully dispatches an attempt
- **THEN** one gestión is written with the provider ref in `channelData` and a
  dispatch-time placeholder outcome
- **AND** when the outcome callback arrives, the same gestión (matched by provider ref)
  is updated with the resolved outcome and AI insight fields — no second entry is created

#### Scenario: Failed dispatch writes no gestión

- **WHEN** a reserved dispatch fails at the provider
- **THEN** no gestión is written (the failure is operational, surfaced in the tick report)

#### Scenario: Operators cannot edit or delete gestiones

- **WHEN** an operator attempts to modify or delete a gestión via the API
- **THEN** the operation is rejected; corrections use a new entry with `correctedEntryId`

## ADDED Requirements

### Requirement: Outcome callbacks are idempotent and never downgrade

Provider outcome callbacks (voice events hook / `POST /api/contact-logs`) SHALL be
idempotent. Re-delivery of the same provider ref SHALL update the existing gestión rather
than create a duplicate, SHALL NOT create duplicate `Objective`s, and SHALL NOT overwrite
a resolved outcome with the dispatch-time placeholder. If a callback arrives before the
dispatch-time entry exists, it SHALL create the entry.

#### Scenario: Re-delivered webhook does not duplicate

- **WHEN** the provider delivers the same outcome callback twice (same provider ref)
- **THEN** the gestión is updated once and at most one `Objective` exists for it

#### Scenario: Late placeholder does not clobber a real outcome

- **WHEN** the dispatch-time write and the outcome callback race, and the callback
  (with a real outcome) is processed first
- **THEN** the later dispatch-time placeholder does not downgrade the recorded outcome

#### Scenario: Callback before dispatch entry creates it

- **WHEN** an outcome callback arrives for a provider ref that has no gestión yet
- **THEN** a gestión is created from the callback
