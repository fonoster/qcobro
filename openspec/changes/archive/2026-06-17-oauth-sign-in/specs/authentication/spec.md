## ADDED Requirements

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
