# authentication Specification

## Purpose

Defines how operators sign in, sign up, and verify their identity in QCobro. Authentication is delegated entirely to the Fonoster Identity gRPC service; the apiserver acts as a thin client that forwards credentials and returns tokens to the console.

## Requirements

### Requirement: Contact verification procedures

The apiserver SHALL expose a procedure to send a one-time verification code to a
contact (email or phone) and a procedure to verify a submitted code, delegating to
Identity. In the local environment the resulting emails SHALL be captured by a
development mailer.

#### Scenario: Verification code is sent to a contact

- **WHEN** a client requests a verification code for an email or phone contact
- **THEN** Identity sends a one-time code to that contact
- **AND** in local runs the email is captured by the development mailer

#### Scenario: Submitting the correct code verifies the contact

- **WHEN** a user submits the code that was sent to their contact
- **THEN** the contact is marked verified in Identity

#### Scenario: An invalid code is rejected

- **WHEN** a user submits an incorrect or expired code
- **THEN** the request is rejected with an error category the console can surface

### Requirement: OAuth2 sign-in and sign-up

The apiserver SHALL expose a procedure to exchange an OAuth2 authorization code for
session tokens (sign in) and a procedure to create an account from an OAuth2
authorization code, returning session tokens (sign up), delegating to Identity. The set
of accepted providers SHALL track what Identity supports.

> Note: Identity currently supports the **GitHub** provider only. A **Google** provider
> is an expected upcoming feature; once available the console's existing "Continuar con
> Google" action will be wired to these procedures.

#### Scenario: Authorization code is exchanged for tokens

- **WHEN** a client submits a valid OAuth2 authorization code for a supported provider
- **THEN** Identity returns id/access/refresh tokens for the corresponding user

#### Scenario: Account is created from an authorization code

- **WHEN** a new user completes the OAuth2 flow and the authorization code is submitted
- **THEN** an account is created in Identity
- **AND** id/access/refresh tokens are returned for the new user

#### Scenario: Unsupported provider is rejected

- **WHEN** a client submits a code for a provider Identity does not support
- **THEN** the request is rejected with an error category the console can surface
