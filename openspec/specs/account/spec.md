# account Specification

## Purpose

Defines self-service account management for authenticated operators — reading their profile, updating name and phone, and deleting their account. All operations are delegated to the Fonoster Identity gRPC service and are scoped to the caller's own user ref.

## Requirements

### Requirement: Self-service account management

The apiserver SHALL let an authenticated user read their own account, update their own
profile (name and phone), and delete their own account, delegating to Identity. Each
operation SHALL act on the caller's own user ref derived from their token, never an
arbitrary ref supplied by the client.

#### Scenario: User reads their own account

- **WHEN** an authenticated user requests their profile
- **THEN** their account details (name, email, phone) are returned from Identity

#### Scenario: User updates their own profile

- **WHEN** an authenticated user updates their name or phone
- **THEN** the change is saved in Identity
- **AND** subsequent profile reads reflect the new values

#### Scenario: User deletes their own account

- **WHEN** an authenticated user deletes their account
- **THEN** the account is removed in Identity
- **AND** the user can no longer authenticate with it
