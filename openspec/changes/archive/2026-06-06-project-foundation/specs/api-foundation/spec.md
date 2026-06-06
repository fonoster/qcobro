## ADDED Requirements

### Requirement: tRPC as the primary internal API

The apiserver SHALL expose its internal API using tRPC, with a composable root router and a typed request context. The context SHALL provide procedures with access to the shared services they depend on — starting with the database client, and extended over time to telephony and other third-party integrations — as well as the authenticated user when present. Services SHALL be exposed through the context (rather than imported ad hoc inside procedures) so they can be substituted in tests.

#### Scenario: Root router composes feature routers

- **WHEN** the apiserver's tRPC root router is inspected
- **THEN** it is assembled from feature routers and exports an `AppRouter` type

#### Scenario: Typed context exposes services and user

- **WHEN** a tRPC procedure executes
- **THEN** it receives a context exposing the available shared services (the database client today; telephony and other integrations as they are introduced) and the current user (or null when unauthenticated)

#### Scenario: New services are added through the context

- **WHEN** a procedure needs a service beyond the database (e.g. telephony or a third-party API)
- **THEN** that service is reached through the request context rather than constructed inside the procedure

### Requirement: Consistent error handling

The API SHALL surface errors using tRPC's typed error shape so that clients can distinguish error categories (e.g. unauthorized, bad input, not found) without parsing message strings.

#### Scenario: Errors carry a typed code

- **WHEN** a procedure throws a `TRPCError`
- **THEN** the response includes a machine-readable error code distinguishing the failure category

### Requirement: Shared schema contracts

API inputs and outputs SHALL be validated against Zod schemas defined in the `common` package, so the same contracts are reused by the web console.

#### Scenario: Procedure input validated from common

- **WHEN** a procedure with input is defined
- **THEN** its input is validated using a Zod schema imported from `@qcobro/common`

### Requirement: Seam for public REST/OpenAPI endpoints

The API foundation SHALL define a structural seam allowing public-facing endpoints to be exposed as REST with an OpenAPI description in a later change, without requiring tRPC internals to be rewritten.

#### Scenario: Public surface is separable

- **WHEN** the apiserver request handling is inspected
- **THEN** the tRPC handler is mounted at a dedicated path that leaves room to mount a separate REST/OpenAPI surface alongside it
