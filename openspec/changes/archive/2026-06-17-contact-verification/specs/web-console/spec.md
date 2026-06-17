## ADDED Requirements

### Requirement: Contact verification after sign-up

After creating an account, the console SHALL take the user to a contact-verification
screen that sends a code to their email and accepts the code to confirm it. The screen
SHALL allow re-sending the code and SHALL let the user skip verification and continue
into the console (a soft gate).

#### Scenario: New account is taken to verification

- **WHEN** a user completes sign-up
- **THEN** they are taken to the contact-verification screen
- **AND** a verification code is sent to their email

#### Scenario: Entering the code completes verification

- **WHEN** the user enters the code from their email and submits
- **THEN** the contact is verified
- **AND** the user proceeds into the console

#### Scenario: Code can be resent

- **WHEN** the user chooses "Reenviar código"
- **THEN** a new verification code is sent to their email

#### Scenario: Verification can be skipped

- **WHEN** the user chooses to skip verification
- **THEN** they continue into the console without verifying
