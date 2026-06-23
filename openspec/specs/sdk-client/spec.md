# sdk-client Specification

## Purpose

The connection and authentication lifecycle of `@qcobro/sdk` — constructing a client against an
endpoint, authenticating (credentials or workspace API key), holding/refreshing tokens, selecting
an active workspace, transparent header injection, and structured surfacing of auth/transport
errors — across Node (≥18) and browser runtimes.

## Requirements

### Requirement: Client construction against an endpoint

The SDK SHALL expose a `Client` that is constructed with the QCobro API endpoint (the apiserver
tRPC URL) and that works in both Node (≥18) and browser runtimes using the platform `fetch`. The
constructor SHALL accept an optional `fetch` implementation override for runtimes without a global
`fetch`.

#### Scenario: Construct with an endpoint

- **WHEN** a developer constructs `new Client({ endpoint })` with a valid URL
- **THEN** a client instance is returned that targets that endpoint and is ready to authenticate

#### Scenario: Custom fetch override

- **WHEN** a developer constructs the client with an explicit `fetch` implementation
- **THEN** the client uses that implementation for all requests instead of the global `fetch`

### Requirement: Authentication lifecycle

The `Client` SHALL allow a caller to authenticate with email and password to obtain Identity tokens,
SHALL hold the resulting access (and refresh) token in memory, and SHALL expose ways to read and
replace the current tokens. The `Client` SHALL also expose a way to exchange a refresh token for a
fresh access token.

#### Scenario: Login obtains and holds tokens

- **WHEN** a caller invokes `login({ email, password })` with valid credentials
- **THEN** the client obtains id/access/refresh tokens from the auth API, stores the access token for
  subsequent calls, and returns the tokens to the caller

#### Scenario: Set tokens directly

- **WHEN** a caller already holds an access token and calls the client's token setter with it
- **THEN** subsequent API calls are made as that authenticated principal without re-logging in

#### Scenario: Refresh the access token

- **WHEN** a caller invokes `refresh()` with a valid refresh token held by the client
- **THEN** the client obtains a new access token and uses it for subsequent calls

### Requirement: Automatic token refresh on expiry

When auto-refresh is enabled (the default) and a refresh token is held, the `Client` SHALL,
upon receiving an `UNAUTHORIZED` response, refresh the access token once and replay the failed
request transparently. Concurrent failures SHALL share a single refresh. If the refresh fails,
or auto-refresh is disabled, or no refresh token is held, the original `UNAUTHORIZED` error
SHALL be surfaced unchanged and SHALL NOT retry indefinitely.

#### Scenario: Expired access token is refreshed and the call replayed

- **WHEN** a workspace-scoped call fails with `UNAUTHORIZED`, auto-refresh is enabled, and a
  refresh token is held
- **THEN** the client refreshes the access token once, replays the request, and returns its result

#### Scenario: Concurrent expired calls refresh only once

- **WHEN** several calls fail with `UNAUTHORIZED` at the same time
- **THEN** the client performs a single refresh shared across them, then replays each call

#### Scenario: Failed refresh surfaces the original error

- **WHEN** the refresh triggered by an `UNAUTHORIZED` response itself fails
- **THEN** the original `UNAUTHORIZED` error is surfaced and the request is not retried further

#### Scenario: Auto-refresh disabled

- **WHEN** the client is constructed with auto-refresh disabled and a call fails with `UNAUTHORIZED`
- **THEN** the error is surfaced directly and no refresh is attempted

### Requirement: API-key authentication

The `Client` SHALL allow a caller to authenticate with a workspace API key (an `accessKeyId`
and `accessKeySecret`) to obtain Identity tokens, for unattended server-to-server integrations.
On success the issued access token SHALL be held and used for subsequent calls, exactly as with
credentials login. An invalid API key SHALL surface a clear authentication error.

#### Scenario: API-key login obtains and holds tokens

- **WHEN** a caller invokes `loginWithApiKey({ accessKeyId, accessKeySecret })` with a valid key
- **THEN** the client obtains tokens, stores the access token for subsequent calls, and returns
  the tokens to the caller

#### Scenario: Invalid API key is rejected

- **WHEN** a caller invokes `loginWithApiKey` with an incorrect `accessKeySecret`
- **THEN** the call rejects with a clear authentication error and no access token is stored

### Requirement: Active workspace selection

The `Client` SHALL let a caller select an active workspace by its accessKeyId, and SHALL apply that
workspace to subsequent workspace-scoped calls.

#### Scenario: Select a workspace

- **WHEN** a caller invokes `useWorkspace(accessKeyId)`
- **THEN** subsequent workspace-scoped calls act within that workspace

### Requirement: Transparent header injection

For every request, the `Client` SHALL attach the `Authorization: Bearer <accessToken>` header when an
access token is set and the `x-workspace: <accessKeyId>` header when an active workspace is selected.
Changing the token or workspace after construction SHALL affect subsequent calls without rebuilding
the client.

#### Scenario: Authenticated, workspace-scoped request

- **WHEN** the client has an access token and an active workspace and makes an API call
- **THEN** the request carries both the bearer token and the workspace header

#### Scenario: Workspace changed after login

- **WHEN** the caller selects a different workspace after authenticating
- **THEN** the next API call carries the newly selected workspace header

### Requirement: Errors are surfaced with context

The `Client` SHALL surface authentication and transport errors to the caller rather than swallowing
them. An unauthenticated call or a call into a workspace the principal does not belong to SHALL
result in a clear error reflecting the server's authorization failure.

#### Scenario: Unauthenticated call is rejected

- **WHEN** a workspace-scoped method is called before authenticating
- **THEN** the call rejects with a clear authorization error

#### Scenario: Wrong-workspace call is rejected

- **WHEN** a caller selects a workspace the authenticated principal is not a member of and makes a call
- **THEN** the call rejects with a clear authorization error
