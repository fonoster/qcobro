## MODIFIED Requirements

### Requirement: Campaign schedule with daily outreach window

A Campaign SHALL have a `startDate` (mandatory), `endDate` (optional), `startTime`
(mandatory, HH:MM 24h), `endTime` (mandatory, HH:MM 24h), and `daysOfWeek` (mandatory, a
non-empty set of weekdays on which the campaign runs). The engine SHALL only dispatch calls
on days included in `daysOfWeek`, and within the daily window defined by `startTime` and
`endTime`.

`startTime` and `endTime` are wall-clock times interpreted in the **workspace's** configured
timezone (`WorkspaceSettings.timezone`, an IANA zone such as `America/Costa_Rica`). The
`qcobro.json → apiserver.timezone` value is only the default used to seed a workspace that
has no timezone set yet; campaigns in different workspaces MAY run on different timezones.

`daysOfWeek` is a set of ISO weekday numbers (1 = Monday … 7 = Sunday) and MAY be any
non-empty combination — e.g. Monday and Friday only. The operator console SHALL present the
days as individually selectable toggles and SHALL render a configured set as a human-readable,
localized label (e.g. "Entre semana", "Fines de semana", "Lun a Vie", a single day, or an
explicit list of days).

#### Scenario: Campaign runs only on selected days

- **WHEN** a campaign is configured with `daysOfWeek` of Monday and Friday
- **THEN** the engine dispatches only on Mondays and Fridays, within the daily window
- **AND** the campaign list shows a human-readable label for those days

#### Scenario: Wall-clock window uses the workspace timezone

- **WHEN** the engine evaluates a campaign's daily outreach window
- **THEN** `startTime`/`endTime` are interpreted in that campaign's workspace timezone
  (`WorkspaceSettings.timezone`), not the deployment-wide default

#### Scenario: Campaign must run on at least one day

- **WHEN** an operator submits a campaign form with no days of the week selected
- **THEN** the system SHALL reject the request with a validation error
