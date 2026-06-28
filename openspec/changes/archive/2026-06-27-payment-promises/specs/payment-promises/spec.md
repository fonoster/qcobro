## ADDED Requirements

### Requirement: PaymentPromise entity — the only tracked outcome

A **PaymentPromise** SHALL be the system record of a debtor's commitment to pay a specific
amount by a specific date. It is the ONLY outcome that QCobro tracks with a lifecycle,
because a payment is the only commitment QCobro can verify (it knows `outstandingBalance`,
observes payment events, and computes `recoveredAmount`).

A `PaymentPromise` SHALL have:

- `id`
- `contactLogId` — FK to the `AccountContactLog` (gestión) that created it
- `portfolioAccountId` — denormalized for direct querying
- `amount Float` — the promised amount
- `dueDate DateTime` — the date by which the debtor committed to pay
- `status` — `PENDING` → `MET` | `EXPIRED` | `CANCELLED`
- `notes?` — additional context from the agent or operator
- `createdAt`, `updatedAt`

A `PaymentPromise` SHALL be created only when a gestión's `outcome` implies a payment
commitment (e.g. `PAYMENT_PROMISE`) and the intent metadata carries an amount and a date.
No other outcome SHALL create a `PaymentPromise`.

A promise is **DUE** when `status` is `PENDING` and `dueDate` has passed. DUE SHALL be
derived at read time; it SHALL NOT be a stored status, and no background job SHALL transition
promises. A DUE promise remains on the worklist until an operator resolves it.

#### Scenario: PaymentPromise created from a payment outcome

- **WHEN** a gestión is written with outcome `PAYMENT_PROMISE`
- **AND** its intent metadata contains a promised amount and a promised date
- **THEN** a `PaymentPromise` is created linked to that gestión with `status` `PENDING`,
  `amount` set to the promised amount, and `dueDate` set to the promised date

#### Scenario: Non-payment outcomes do not create a PaymentPromise

- **WHEN** a gestión is written with an outcome such as `NEW_TERMS`, `DISPUTE_RAISED`,
  `INFORMATION_REQUEST`, or `CALLBACK_REQUESTED`
- **THEN** no `PaymentPromise` is created

#### Scenario: A promise past its date is surfaced as DUE

- **WHEN** a `PENDING` promise's `dueDate` has passed
- **THEN** it is reported as DUE (derived) and surfaced on the operator worklist
- **AND** no status is stored or transitioned automatically

#### Scenario: Re-delivery does not create a duplicate

- **WHEN** the same inbound event that produced a `PaymentPromise` is delivered again
- **THEN** no second `PaymentPromise` is created for the same gestión

### Requirement: PaymentPromise resolution is operator-driven

A `PaymentPromise` SHALL leave `PENDING` only by explicit resolution. An operator MAY mark
it `MET` (paid) or `CANCELLED` (dismissed); a confirming payment event MAY also mark it
`MET`. A met promise SHALL feed `PortfolioAccount.recoveredAmount`. Resolving a promise
SHALL NOT require a new gestión entry. There SHALL be no "broken" status — an unpaid promise
stays DUE on the worklist until resolved or expired.

#### Scenario: Operator marks a promise paid

- **WHEN** an operator marks a `PENDING` (or DUE) promise as paid
- **THEN** its `status` becomes `MET`
- **AND** the amount feeds `PortfolioAccount.recoveredAmount`
- **AND** no new gestión entry is required

#### Scenario: Payment event confirms a promise

- **WHEN** a payment event confirms payment against a `PENDING` promise
- **THEN** its `status` becomes `MET` and feeds `recoveredAmount`

#### Scenario: Operator cancels a promise

- **WHEN** an operator cancels a `PENDING` promise
- **THEN** its `status` becomes `CANCELLED`
- **AND** it is excluded from the fulfillment-rate calculation

### Requirement: PaymentPromise expires when its account leaves the portfolio

When a `PortfolioAccount` is removed from its portfolio, the system SHALL set that account's
`PENDING` PaymentPromises to `EXPIRED` so collectors do not chase an account no longer theirs.
An operator MAY also set a promise `EXPIRED` manually. EXPIRED promises SHALL remain
visible on the worklist, flagged do-not-reach, and SHALL be excluded from the
fulfillment-rate calculation.

#### Scenario: Account removed from portfolio expires its promises

- **WHEN** an account with `PENDING` payment promises is removed from its portfolio
- **THEN** those promises are set to `EXPIRED`
- **AND** they remain visible on the worklist marked as no longer applicable

#### Scenario: Expired promises are excluded from fulfillment rate

- **WHEN** the worklist computes fulfillment rate
- **THEN** `EXPIRED` (and `CANCELLED`) promises are excluded from both numerator and
  denominator

### Requirement: Operator follows up on a promise via ad-hoc agent dispatch

From a payment promise, an operator SHALL be able to follow up by selecting an **agent
template** (channel + script/voice) and dispatching it against the account through the
existing dispatch layer. The resulting gestión SHALL be written with `campaignId` null, the
chosen `agentTemplateId`, and a link to the promise. A follow-up SHALL NOT attach to a
campaign and SHALL NOT create or modify any `CampaignAccountState`. Escalation is expressed
by choosing a firmer agent template.

#### Scenario: Follow-up dispatches an agent template with no campaign

- **WHEN** an operator follows up on a DUE promise by selecting an agent template
- **THEN** the template is dispatched against the account
- **AND** a gestión is written with `campaignId` null, the selected `agentTemplateId`, and a
  reference to the promise
- **AND** no `CampaignAccountState` record is created or modified

#### Scenario: Follow-up history is visible on the promise

- **WHEN** an operator opens a promise that has been followed up on
- **THEN** the follow-up gestiones linked to that promise are listed in order
