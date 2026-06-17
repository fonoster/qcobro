## ADDED Requirements

### Requirement: Identity runs as a standalone gRPC service

The system SHALL run Fonoster Identity as a standalone gRPC service with its own PostgreSQL database, separate from the application database. The service SHALL be available in the local environment via Docker Compose.

#### Scenario: Identity service is reachable

- **WHEN** the local environment is started via Docker Compose
- **THEN** an Identity gRPC service is running with its own PostgreSQL database
- **AND** it is reachable by the apiserver at a configured host and port

#### Scenario: Identity database is provisioned

- **WHEN** the Identity service starts against an empty database
- **THEN** the Identity schema is applied (via its vendored migrations) before the service accepts requests

### Requirement: Generated gRPC client for Identity

The apiserver SHALL communicate with the Identity service through a generated TypeScript gRPC client derived from the Identity proto (`fonoster.identity.v1beta2`). The client SHALL be regenerable from a vendored copy of the proto.

#### Scenario: Client is generated from the proto

- **WHEN** the client generation step is run against the vendored `identity.proto`
- **THEN** typed client stubs for the Identity service are produced
- **AND** the apiserver imports those stubs to call Identity

### Requirement: Identity service configuration

The Identity service SHALL be configured entirely through environment, including its database URL, RS256 signing key pair, field-encryption key, token expirations, SMTP settings, and verification/2FA flags. No secrets SHALL be hardcoded, and the expected variables SHALL be documented.

#### Scenario: Configuration is environment-driven

- **WHEN** the Identity service configuration is inspected
- **THEN** the database URL, key pair, encryption key, and SMTP settings are read from environment variables
- **AND** the required variables are documented in the example env file
