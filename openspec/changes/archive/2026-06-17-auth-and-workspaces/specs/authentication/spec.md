## ADDED Requirements

### Requirement: Self-service sign-up

The apiserver SHALL expose a procedure that lets anyone create a user account with at least a name, email, and password, delegating creation to the Identity service. Inputs SHALL be validated against a Zod schema in `@qcobro/common`.

#### Scenario: New account is created

- **WHEN** a sign-up request is made with a valid name, email, and password
- **THEN** a user is created in Identity
- **AND** the account can subsequently be used to log in

#### Scenario: Duplicate email is rejected

- **WHEN** a sign-up request uses an email that already exists
- **THEN** the procedure returns a typed error and no duplicate user is created

### Requirement: Login issues tokens

The apiserver SHALL expose a login procedure that exchanges email and password credentials with Identity and returns the issued access and refresh tokens (and id token) to the client.

#### Scenario: Valid credentials return tokens

- **WHEN** login is called with correct credentials
- **THEN** Identity issues id, access, and refresh tokens
- **AND** the tokens are returned to the client

#### Scenario: Invalid credentials are rejected

- **WHEN** login is called with an incorrect password
- **THEN** the procedure returns an unauthorized-category error and no tokens are issued

### Requirement: Token refresh and logout

The apiserver SHALL expose a procedure to exchange a refresh token for a new access token, delegating to Identity. It SHALL also expose a logout procedure; because the Identity service does not implement server-side token revocation, logout is a client concern — the client discards its stored tokens, which expire on their own — and the procedure returns a server-side acknowledgement.

#### Scenario: Refresh yields a new access token

- **WHEN** the refresh procedure is called with a valid refresh token
- **THEN** a new access token is returned

#### Scenario: Logout acknowledges and the client clears its session

- **WHEN** the logout procedure is called
- **THEN** it returns success and the client discards its stored tokens

### Requirement: Password reset and contact verification

The apiserver SHALL expose procedures to request a password-reset code and to reset a password, and to send and verify a contact (email) verification code, delegating to Identity. In the local environment, the resulting emails SHALL be captured by a development mailer.

#### Scenario: Reset code is sent and password is changed

- **WHEN** a user requests a password reset and then submits a valid reset code with a new password
- **THEN** the password is updated in Identity
- **AND** the reset email is captured by the development mailer in local runs
