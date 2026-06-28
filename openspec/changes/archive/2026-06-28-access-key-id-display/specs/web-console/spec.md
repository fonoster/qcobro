## ADDED Requirements

### Requirement: Workspace accessKeyId is visible and copyable

The console SHALL display each workspace's `accessKeyId` to the operator and SHALL provide
a one-click affordance to copy it to the clipboard, so operators can use it for SDK and API
integration (the `x-workspace` header and `useWorkspace(accessKeyId)`). The `accessKeyId`
SHALL be shown on the workspace picker cards and on the dashboard for the active workspace.
The displayed value SHALL be the `accessKeyId` already present on the workspace payload; no
secret is exposed. All labels and copy-confirmation text SHALL resolve through the i18n
layer.

#### Scenario: accessKeyId shown on each workspace card

- **WHEN** the operator views the workspace picker at `/workspaces`
- **THEN** each workspace card displays that workspace's `accessKeyId`

#### Scenario: Copy accessKeyId from a workspace card

- **WHEN** the operator activates the copy affordance on a workspace card
- **THEN** that workspace's `accessKeyId` is written to the clipboard
- **AND** a transient confirmation is shown
- **AND** activating the copy affordance does not select/switch into that workspace

#### Scenario: Active workspace accessKeyId shown on the dashboard

- **WHEN** the operator views the Panel de control with an active workspace selected
- **THEN** the dashboard displays the active workspace's `accessKeyId` in a small area near the page header with a copy affordance

#### Scenario: Copy accessKeyId from the dashboard

- **WHEN** the operator activates the copy affordance on the dashboard
- **THEN** the active workspace's `accessKeyId` is written to the clipboard
- **AND** a transient confirmation is shown
