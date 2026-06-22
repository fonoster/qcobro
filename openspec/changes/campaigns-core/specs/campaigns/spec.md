## ADDED Requirements

### Requirement: Campaign entity with lifecycle status

A Campaign SHALL represent a scheduled outreach program targeting one or more portfolios
via a single AgentTemplate. It SHALL have the following status lifecycle:
`DRAFT` → `ACTIVE` → `PAUSED` → `COMPLETED` → `ARCHIVED`.

A campaign in `DRAFT` status is not visible to the engine; no outreach is performed.
A campaign in `ACTIVE` status is eligible for engine dispatch within its scheduled window.
A campaign in `PAUSED` status halts new dispatches but retains all data and progress.
A campaign in `COMPLETED` status is read-only; its end date has passed or it was
manually completed.
A campaign in `ARCHIVED` status is hidden from default list views.

#### Scenario: Operator creates a campaign in DRAFT

- **WHEN** an operator submits the create campaign form with a name, at least one
  portfolio, an agent template, a start date, a start time, an end time, and attempt caps
- **THEN** the campaign is created with status `DRAFT`
- **AND** the campaign is visible in the campaign list

#### Scenario: Campaign transitions to ACTIVE

- **WHEN** an operator sets a DRAFT or PAUSED campaign to ACTIVE
- **THEN** the campaign status is saved as ACTIVE
- **AND** the engine may begin dispatching to eligible accounts within the schedule window

#### Scenario: Campaign can be paused

- **WHEN** an operator sets an ACTIVE campaign to PAUSED
- **THEN** no new dispatches are initiated
- **AND** attempt counts and suppression state are preserved
- **AND** the campaign can be returned to ACTIVE

#### Scenario: ARCHIVED campaigns hidden by default

- **WHEN** the campaign list is loaded with no filter
- **THEN** campaigns with status ARCHIVED are not included in the results

### Requirement: Campaign references an AgentTemplate

A Campaign SHALL reference exactly one `AgentTemplate`. The template determines the
channel and all agent configuration for every dispatch in that campaign.
`agentTemplateId` is immutable after campaign creation.

#### Scenario: Agent template cannot be changed after creation

- **WHEN** an operator attempts to update the `agentTemplateId` of an existing campaign
- **THEN** the system SHALL reject the update with a validation error

#### Scenario: Campaign cannot reference a template from another workspace

- **WHEN** an operator attempts to create a campaign referencing a template not owned
  by the active workspace
- **THEN** the system SHALL reject the request with a validation error

### Requirement: Campaign schedule with daily outreach window

A Campaign SHALL have a `startDate` (mandatory), `endDate` (optional), `startTime`
(mandatory, HH:MM 24h), and `endTime` (mandatory, HH:MM 24h). The engine SHALL only
dispatch calls within the daily window defined by `startTime` and `endTime`.

`startTime` and `endTime` are wall-clock times interpreted in the deployment's
configured timezone (`qcobro.json` → `apiserver.timezone`, an IANA zone such as
`America/Costa_Rica`). Per-workspace timezones are deferred; for now all campaigns in
a deployment share one timezone.

#### Scenario: Campaign without end date runs indefinitely

- **WHEN** a campaign is created without an end date
- **THEN** the engine continues dispatching on ACTIVE days until the campaign is
  manually completed or paused

#### Scenario: Engine enforces end date without API status update

- **WHEN** the current date is past the campaign's end date
- **THEN** the engine treats the campaign as expired and stops dispatching
- **AND** the API server does not automatically update the status to COMPLETED

#### Scenario: End date must be after start date

- **WHEN** an operator submits a campaign form with an end date before the start date
- **THEN** the system SHALL reject the request with a validation error

### Requirement: Campaign attempt caps

A Campaign SHALL define `maxAttemptsPerAccount` (lifetime cap per account for this
campaign) and `maxAttemptsPerDay` (daily cap per account). Both are mandatory at
creation. The engine enforces these caps via `CampaignAccountState`.

#### Scenario: Account excluded when lifetime cap reached

- **WHEN** `CampaignAccountState.attemptCount` equals `Campaign.maxAttemptsPerAccount`
  for an account
- **THEN** the engine SHALL not dispatch any further attempts to that account for this
  campaign, regardless of campaign status

#### Scenario: Account excluded for remainder of day when daily cap reached

- **WHEN** `CampaignAccountState.attemptsToday` equals `Campaign.maxAttemptsPerDay`
- **THEN** the engine SHALL skip that account until `attemptsToday` is reset at midnight

### Requirement: Campaign-to-portfolio association (many-to-many)

A Campaign SHALL be associated with one or more portfolios at creation time. An operator
SHALL be able to associate a campaign with any portfolio belonging to the same workspace.

#### Scenario: Campaign targets multiple portfolios

- **WHEN** an operator creates a campaign and selects two portfolios
- **THEN** accounts from both portfolios are eligible for dispatch under that campaign

#### Scenario: Campaign must have at least one portfolio

- **WHEN** an operator attempts to create a campaign with no portfolios selected
- **THEN** the system SHALL reject the request with a validation error

### Requirement: CampaignAccountState tracks per-account progress

For every account dispatched under a campaign, a `CampaignAccountState` record SHALL
track: `attemptCount`, `attemptsToday`, `lastAttemptAt`, and `suppressUntil`
(campaign-local soft suppression).

`CampaignAccountState.suppressUntil` applies only to this campaign. The global
`PortfolioAccount.suppressUntil` applies across all campaigns.

#### Scenario: State record created on first dispatch

- **WHEN** the engine dispatches to an account under a campaign for the first time
- **THEN** a `CampaignAccountState` record is created with `attemptCount = 1`
  and `attemptsToday = 1`

#### Scenario: Campaign-local suppression does not block other campaigns

- **WHEN** account A has a PAYMENT_PROMISE outcome in campaign X, setting
  `CampaignAccountState.suppressUntil` for campaign X
- **THEN** account A remains eligible for dispatch under campaign Y (a different campaign)
