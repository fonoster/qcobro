# campaigns Specification

## Purpose

TBD — created by syncing change campaigns-core. Update Purpose after archive.

## Requirements

### Requirement: Campaign entity with lifecycle status

A Campaign SHALL represent a scheduled outreach program targeting one or more portfolios
via a single AgentTemplate. It SHALL have the following status lifecycle:
`ACTIVE` ⇄ `PAUSED` → `COMPLETED` → `ARCHIVED`.

A newly created campaign starts in `ACTIVE` status: every field is mandatory at creation and
outreach begins immediately within the scheduled window. There is no separate draft state.
A campaign in `PAUSED` status is not visible to the engine; no outreach is performed, and all
data and progress are retained.
A campaign in `ACTIVE` status is eligible for engine dispatch within its scheduled window.
A campaign in `COMPLETED` status is read-only; its end date has passed or it was
manually completed.
A campaign in `ARCHIVED` status is hidden from default list views.

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

#### Scenario: Campaign transitions to ACTIVE

- **WHEN** an operator sets a PAUSED campaign to ACTIVE
- **THEN** the campaign status is saved as ACTIVE
- **AND** the engine may begin dispatching to eligible accounts within the schedule window

#### Scenario: ARCHIVED campaigns hidden by default

- **WHEN** the campaign list is loaded with no filter
- **THEN** campaigns with status ARCHIVED are not included in the results

### Requirement: Campaign deletion limited to campaigns with no attempts

A Campaign SHALL be deletable only while it has no recorded outreach attempts (its lifetime
attempt total is zero across all `CampaignAccountState` rows). Once any attempt has been made,
a campaign SHALL NOT be hard-deleted; operators archive it instead. Deletion is independent of
status — deletability keys off recorded progress only.

#### Scenario: Fresh campaign can be deleted

- **WHEN** an operator deletes a campaign that has no recorded attempts
- **THEN** the campaign and its configuration are removed

#### Scenario: Campaign with attempts cannot be deleted

- **WHEN** an operator attempts to delete a campaign that has recorded at least one attempt
- **THEN** the system SHALL reject the deletion with a validation error
- **AND** the operator may archive the campaign instead

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
(mandatory, HH:MM 24h), `endTime` (mandatory, HH:MM 24h), and `daysOfWeek` (mandatory, a
non-empty set of weekdays on which the campaign runs). The engine SHALL only dispatch calls
on days included in `daysOfWeek`, and within the daily window defined by `startTime` and
`endTime`.

`startTime` and `endTime` are wall-clock times interpreted in the deployment's
configured timezone (`qcobro.json` → `apiserver.timezone`, an IANA zone such as
`America/Costa_Rica`). Per-workspace timezones are deferred; for now all campaigns in
a deployment share one timezone.

`daysOfWeek` is a set of ISO weekday numbers (1 = Monday … 7 = Sunday) and MAY be any
non-empty combination — e.g. Monday and Friday only. The operator console SHALL present the
days as individually selectable toggles and SHALL render a configured set as a human-readable,
localized label (e.g. "Entre semana", "Fines de semana", "Lun a Vie", a single day, or an
explicit list of days).

#### Scenario: Campaign runs only on selected days

- **WHEN** a campaign is configured with `daysOfWeek` of Monday and Friday
- **THEN** the engine dispatches only on Mondays and Fridays, within the daily window
- **AND** the campaign list shows a human-readable label for those days

#### Scenario: Campaign must run on at least one day

- **WHEN** an operator submits a campaign form with no days of the week selected
- **THEN** the system SHALL reject the request with a validation error

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
