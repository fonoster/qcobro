## MODIFIED Requirements

### Requirement: Campaign entity with lifecycle status

A Campaign SHALL represent a scheduled outreach program targeting one or more portfolios
via a single AgentTemplate. It SHALL have the following status lifecycle:
`ACTIVE` ⇄ `PAUSED` → `COMPLETED` → `ARCHIVED`, where `ARCHIVED` MAY be restored to
`PAUSED`.

A newly created campaign starts in `ACTIVE` status: every field is mandatory at creation and
outreach begins immediately within the scheduled window. There is no separate draft state.
A campaign in `PAUSED` status is not visible to the engine; no outreach is performed, and all
data and progress are retained.
A campaign in `ACTIVE` status is eligible for engine dispatch within its scheduled window.
A campaign in `COMPLETED` status is read-only; its end date has passed or it was
manually completed.
A campaign in `ARCHIVED` status is hidden from default list views. `ARCHIVED` is not
terminal: an operator MAY restore an archived campaign, which returns it to `PAUSED` so it
never resumes dispatch without an explicit later activation.

A Campaign transitioned to `PAUSED` SHALL carry a `pauseReason` of either `MANUAL` (an operator
paused it) or `AUTO_ERROR_THRESHOLD` (the engine's consecutive-system-error circuit breaker
paused it). `pauseReason` SHALL be cleared whenever the campaign leaves `PAUSED`.

#### Scenario: Operator creates a campaign in ACTIVE

- **WHEN** an operator submits the create campaign form with a name, at least one
  portfolio, an agent template, a start date, a start time, an end time, the days of the
  week it runs, and attempt caps
- **THEN** the campaign is created with status `ACTIVE`
- **AND** the campaign is visible in the campaign list

#### Scenario: Campaign transitions to PAUSED

- **WHEN** an operator sets an ACTIVE campaign to PAUSED
- **THEN** no new dispatches are initiated
- **AND** attempt counts and suppression state are preserved
- **AND** the campaign can be returned to ACTIVE
- **AND** `pauseReason` is set to `MANUAL`

#### Scenario: Campaign transitions to ACTIVE

- **WHEN** an operator sets a PAUSED campaign to ACTIVE
- **THEN** the campaign status is saved as ACTIVE
- **AND** `pauseReason` is cleared
- **AND** the engine may begin dispatching to eligible accounts within the schedule window

#### Scenario: Operator archives a campaign

- **WHEN** an operator archives an ACTIVE, PAUSED, or COMPLETED campaign
- **THEN** the campaign status is saved as ARCHIVED
- **AND** the campaign is removed from default list views

#### Scenario: Operator restores an archived campaign

- **WHEN** an operator restores an ARCHIVED campaign
- **THEN** the campaign status is saved as PAUSED
- **AND** no dispatch resumes until the operator activates it

#### Scenario: ARCHIVED campaigns hidden by default

- **WHEN** the campaign list is loaded with no filter
- **THEN** campaigns with status ARCHIVED are not included in the results

#### Scenario: Engine auto-pauses a campaign with a distinct reason

- **WHEN** the engine's consecutive-system-error circuit breaker trips for an ACTIVE campaign
- **THEN** the campaign transitions to `PAUSED` with `pauseReason: AUTO_ERROR_THRESHOLD`
- **AND** it behaves exactly as any other `PAUSED` campaign (invisible to the engine, no
  dispatch, all data retained) until an operator reactivates it

### Requirement: Campaign attempt caps

A Campaign SHALL define `maxAttemptsPerAccount` (lifetime cap per account for this
campaign) and `maxAttemptsPerDay` (daily cap per account). Both are mandatory at
creation. The engine enforces these caps via `CampaignAccountState`.

Only attempts that reach the recipient side of the dispatch — a successful send or a
`DispatchError` with `kind: DELIVERY_REJECTED` — count toward these caps. An attempt that fails
with `kind: SYSTEM_ERROR` SHALL NOT be counted, since the account was never actually reached.

#### Scenario: Account excluded when lifetime cap reached

- **WHEN** `CampaignAccountState.attemptCount` equals `Campaign.maxAttemptsPerAccount`
  for an account
- **THEN** the engine SHALL not dispatch any further attempts to that account for this
  campaign, regardless of campaign status

#### Scenario: Account excluded for remainder of day when daily cap reached

- **WHEN** `CampaignAccountState.attemptsToday` equals `Campaign.maxAttemptsPerDay`
- **THEN** the engine SHALL skip that account until `attemptsToday` is reset at midnight

#### Scenario: System-error failures do not erode the cap

- **WHEN** an account has been dispatched to several times but every attempt failed with
  `kind: SYSTEM_ERROR`
- **THEN** `attemptCount` and `attemptsToday` remain at the value they held before those
  attempts, and the account is not excluded by either cap on their account
