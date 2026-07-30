# realtime-streaming Specification

## Purpose

A WebSocket-based tRPC subscription transport, separate from the HTTP batch transport,
letting the API server push server-originated change signals to connected clients. First
consumer is the Gestiones list and Gestión detail screens (see the `account-contact-log`
capability's realtime requirements); the transport itself is reusable by later screens.

## Requirements

### Requirement: WebSocket streaming transport for tRPC subscriptions

The API server SHALL expose a WebSocket-based tRPC subscription transport, separate from
the existing HTTP batch endpoint, so procedures can push server-originated events to
connected clients. The transport SHALL be workspace-scoped using the same authentication
model (Identity access token + active-workspace membership) as the HTTP path, adapted to
travel over the WebSocket connection's initial handshake rather than per-request headers.

#### Scenario: WebSocket connection resolves the same auth/workspace context as HTTP

- **WHEN** a client opens a WebSocket connection carrying a valid access token and an
  active-workspace identifier the token's principal belongs to
- **THEN** the connection's context includes the authenticated user and active workspace,
  equivalently to how the HTTP tRPC context resolves them from request headers

#### Scenario: Invalid or missing credentials yield no active workspace

- **WHEN** a WebSocket connection is opened without a valid token, or with a workspace the
  token's principal does not belong to
- **THEN** procedures requiring an active workspace reject the call, matching the existing
  `workspaceProcedure` behavior on the HTTP path

### Requirement: Contact-log and payment-promise change signals

The API server SHALL emit a change signal whenever an `AccountContactLog` row is created or
updated, or a `PaymentPromise` row is created or updated, carrying only the affected gestión's
id and its owning workspace — never the row's data. Every existing write path (manual create,
campaign-engine dispatch, webhook ingestion, AI insight generation, payment-promise
resolution) SHALL produce this signal without requiring each call site to publish it
individually.

#### Scenario: A gestión write from any path produces a signal

- **WHEN** an `AccountContactLog` row is created or updated, regardless of which code path
  performed the write
- **THEN** a change signal is emitted carrying that gestión's id and its owning workspace

#### Scenario: A payment-promise write produces a signal for its gestión

- **WHEN** a `PaymentPromise` row is created or updated
- **THEN** a change signal is emitted carrying the id of the `AccountContactLog` it is
  linked to and that gestión's owning workspace

### Requirement: `campaigns.contactLog.onChange` subscription procedure

The API server SHALL expose a workspace-scoped tRPC subscription, `campaigns.contactLog
.onChange`, that streams change signals (gestión id) to the caller. The subscription SHALL
accept an optional gestión id to narrow the stream to a single gestión; when provided, the
server SHALL verify the caller's workspace owns that gestión before streaming. When omitted,
the subscription streams every change signal for the caller's active workspace.

#### Scenario: Unfiltered subscription streams all workspace changes

- **WHEN** a client subscribes to `campaigns.contactLog.onChange` without an id
- **THEN** the client receives a signal for every gestión change signal emitted for its
  active workspace, and none from other workspaces

#### Scenario: Id-filtered subscription streams only that gestión's changes

- **WHEN** a client subscribes to `campaigns.contactLog.onChange` with a specific gestión id
  it owns (via its active workspace)
- **THEN** the client receives signals only for changes to that gestión (directly or via its
  linked payment promise)

#### Scenario: Id-filtered subscription rejects a gestión outside the caller's workspace

- **WHEN** a client subscribes to `campaigns.contactLog.onChange` with a gestión id that does
  not belong to its active workspace
- **THEN** the subscription is rejected the same way `campaigns.contactLog.get` rejects that
  id
