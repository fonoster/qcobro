## ADDED Requirements

### Requirement: Switching workspaces refreshes the current screen

The console SHALL refresh the currently mounted screen's data whenever the active workspace
changes, regardless of which control triggered the switch (the sidebar workspace switcher, or the
workspaces hub's select/create flows) and without requiring a manual reload or navigation.

#### Scenario: Switching via the sidebar switcher updates the dashboard in place

- **WHEN** a user switches the active workspace using the sidebar workspace switcher while viewing
  the dashboard
- **THEN** the dashboard immediately reflects the newly active workspace's data
- **AND** no data from the previously active workspace remains visible

#### Scenario: Creating or selecting a workspace from the hub also refreshes

- **WHEN** a user creates or selects a workspace from the workspaces hub
- **THEN** the workspace they land in shows that workspace's own data, not stale data left over
  from a previously active workspace
