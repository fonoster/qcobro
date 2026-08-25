## MODIFIED Requirements

### Requirement: List workspace API keys

The system SHALL let an authenticated caller list the API keys belonging to the active workspace.
The list SHALL NEVER include the `accessKeySecret`. Each row SHALL show the `accessKeyId`, `role`,
creation date, and expiry.

#### Scenario: Listing returns keys without secrets

- **WHEN** an authorized member opens the API keys page for a workspace that has keys
- **THEN** each key is shown with its accessKeyId, role, creation date, and expiry
- **AND** no key's secret is present in the response or the UI

#### Scenario: Empty state

- **WHEN** an authorized member opens the API keys page for a workspace with no keys
- **THEN** an empty state inviting them to create the first key is shown

### Requirement: Create an API key

The system SHALL let an authorized caller create an API key for the active workspace. Every API key
is granted the workspace admin role — Fonoster Identity only issues admin-scoped keys, so there is
no role to choose. The create response SHALL include the generated `accessKeyId` and
`accessKeySecret`. The `accessKeySecret` SHALL be presented to the operator **exactly once**, at
creation time, and SHALL NOT be retrievable afterward.

The operator MAY set an expiration when creating a key. When no expiration is set, the key does not
expire.

#### Scenario: Create a key without an expiration

- **WHEN** an authorized member confirms creation without setting an expiration
- **THEN** a new admin-scoped key is created with no expiration
- **AND** the new accessKeySecret is displayed once with a copy-to-clipboard control
- **AND** the new key appears in the list (without its secret) after the dialog is dismissed

#### Scenario: Create a key with an expiration

- **WHEN** an authorized member sets a future expiration and confirms creation
- **THEN** a new admin-scoped key is created with that expiration
- **AND** the expiration is reflected in the list once the dialog is dismissed

#### Scenario: A past expiration is rejected

- **WHEN** a create request specifies an expiration that is not in the future
- **THEN** the request is rejected with a structured validation error
- **AND** no key is created

#### Scenario: A non-admin role is rejected

- **WHEN** a create request specifies a role other than the workspace admin role
- **THEN** the request is rejected with a structured validation error
- **AND** no key is created

#### Scenario: Secret is shown only once

- **WHEN** the show-secret dialog for a newly created key is dismissed
- **THEN** the secret cannot be viewed again from the list or anywhere else in the UI
