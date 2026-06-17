## ADDED Requirements

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
