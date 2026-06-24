## ADDED Requirements

### Requirement: List workspace API keys

The system SHALL let an authenticated caller list the API keys belonging to the active workspace.
The list SHALL NEVER include the `accessKeySecret`. Each row SHALL show the `accessKeyId`, `role`,
and expiry. The creation date is **not shown**: Identity returns `createdAt` through an `int32`
proto field that overflows for an epoch-ms `Date`, yielding a garbage value, so the column is
omitted until the timestamp is widened upstream.

#### Scenario: Listing returns keys without secrets

- **WHEN** an authorized member opens the API keys page for a workspace that has keys
- **THEN** each key is shown with its accessKeyId, role, and expiry
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

Keys are created without an expiration. A configurable expiry is **not offered**: Identity's gRPC
contract types the timestamp fields as `int32`, which cannot represent an epoch-millisecond `Date`,
so an expiry cannot be stored correctly until that is widened upstream. The shared
`createApiKeySchema` keeps an optional `expiresAt` for forward compatibility, but the operator UI
does not expose it.

#### Scenario: Create a key

- **WHEN** an authorized member confirms creation
- **THEN** a new admin-scoped key is created with no expiration
- **AND** the new accessKeySecret is displayed once with a copy-to-clipboard control
- **AND** the new key appears in the list (without its secret) after the dialog is dismissed

#### Scenario: A non-admin role is rejected

- **WHEN** a create request specifies a role other than the workspace admin role
- **THEN** the request is rejected with a structured validation error
- **AND** no key is created

#### Scenario: Secret is shown only once

- **WHEN** the show-secret dialog for a newly created key is dismissed
- **THEN** the secret cannot be viewed again from the list or anywhere else in the UI

### Requirement: Regenerate an API key

The system SHALL let an authorized caller regenerate a key identified by its `ref`, rotating its
`accessKeySecret` while keeping the same `ref` and `role`. The previous secret SHALL stop working.
The new `accessKeySecret` SHALL be presented exactly once, as on creation.

#### Scenario: Regenerate rotates the secret

- **WHEN** an authorized member regenerates an existing key
- **THEN** a new accessKeySecret is issued and displayed once
- **AND** the key keeps its ref and role
- **AND** the previously issued secret no longer authenticates

#### Scenario: Regenerate requires confirmation

- **WHEN** an authorized member triggers regenerate
- **THEN** they are warned that the current secret will stop working before the rotation proceeds

### Requirement: Delete an API key

The system SHALL let an authorized caller delete a key identified by its `ref`. Deletion is a hard
removal and serves as the revocation mechanism — there is no separate disable/revoke state. After
deletion the key SHALL no longer authenticate and SHALL NOT appear in the list.

#### Scenario: Delete revokes the key

- **WHEN** an authorized member confirms deletion of a key
- **THEN** the key is permanently removed
- **AND** it no longer appears in the list
- **AND** its credentials no longer authenticate

#### Scenario: Delete is guarded by confirmation

- **WHEN** an authorized member initiates deletion
- **THEN** a confirmation step is required before the key is removed

### Requirement: Authorization for API-key management

The system SHALL restrict API-key management to workspace owners and admins. A workspace member
without the owner or admin role SHALL NOT be able to list, create, regenerate, or delete keys, and
the management surface SHALL NOT be offered to them.

#### Scenario: Non-admin cannot manage keys

- **WHEN** a user whose role in the active workspace is neither owner nor admin reaches the API
  keys surface
- **THEN** management actions are not available to them

#### Scenario: Owner or admin can manage keys

- **WHEN** a user who is a workspace owner or admin opens the API keys page
- **THEN** they can list, create, regenerate, and delete keys
