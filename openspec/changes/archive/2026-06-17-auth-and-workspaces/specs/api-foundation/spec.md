## MODIFIED Requirements

### Requirement: tRPC as the primary internal API

The apiserver SHALL expose its internal API using tRPC, with a composable root router and a typed request context. The context SHALL provide procedures with access to the shared services they depend on — the database client, the Identity gRPC client, and other third-party integrations as they are introduced — and SHALL expose the authenticated principal when a request carries a valid access token: the user, the active workspace (`accessKeyId`), and the caller's role in that workspace. When no valid token is present, the principal SHALL be absent (the request is unauthenticated). Services SHALL be exposed through the context (rather than imported ad hoc inside procedures) so they can be substituted in tests.

#### Scenario: Root router composes feature routers

- **WHEN** the apiserver's tRPC root router is inspected
- **THEN** it is assembled from feature routers and exports an `AppRouter` type

#### Scenario: Typed context exposes services and principal

- **WHEN** a tRPC procedure executes
- **THEN** it receives a context exposing the available shared services (database client and Identity client today; others as they are introduced)
- **AND** the authenticated user, active workspace, and role when the request carries a valid access token, or an absent principal when it does not

#### Scenario: New services are added through the context

- **WHEN** a procedure needs a service beyond the database (e.g. the Identity client or a telephony API)
- **THEN** that service is reached through the request context rather than constructed inside the procedure
