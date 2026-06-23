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
