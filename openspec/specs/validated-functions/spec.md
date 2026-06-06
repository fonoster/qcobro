# validated-functions Specification

## Purpose

TBD - created by archiving change function-conventions. Update Purpose after archive.

## Requirements

### Requirement: Validation-and-error-handling wrapper

`@qcobro/common` SHALL provide a `withErrorHandlingAndValidation` higher-order function that takes an async function and a Zod schema and returns a function which validates its input against the schema before invoking the wrapped function. On valid input it SHALL pass the parsed, typed value through; on invalid input it SHALL throw a `ValidationError` and SHALL NOT invoke the wrapped function.

#### Scenario: Valid input reaches the wrapped function

- **WHEN** the wrapped function is called with input that satisfies the schema
- **THEN** the inner function runs with the parsed, typed value
- **AND** its resolved result is returned to the caller

#### Scenario: Invalid input is rejected before execution

- **WHEN** the wrapped function is called with input that violates the schema
- **THEN** a `ValidationError` is thrown
- **AND** the inner function is never invoked

### Requirement: Structured validation error

`@qcobro/common` SHALL provide a `ValidationError` class that wraps a Zod error into structured details. It SHALL expose a stable `code` of `"VALIDATION_ERROR"`, a human-readable `message`, a `fieldErrors` array where each entry has `field`, `message`, and `code`, the original `zodError`, and a `toJSON()` method returning a serializable representation suitable for API responses.

#### Scenario: Field-level errors are extracted

- **WHEN** a `ValidationError` is constructed from a Zod error with one or more failing fields
- **THEN** `fieldErrors` contains an entry per issue with the field path, message, and issue code
- **AND** `code` equals `"VALIDATION_ERROR"`

#### Scenario: Serializable for API responses

- **WHEN** `toJSON()` is called on a `ValidationError`
- **THEN** it returns an object containing `code`, `message`, and `fieldErrors`

### Requirement: Exposed from the package entry

The new utilities SHALL be exported from the `@qcobro/common` package entry so consumers import them directly from `@qcobro/common`.

#### Scenario: Importable from the package root

- **WHEN** a consumer imports from `@qcobro/common`
- **THEN** `withErrorHandlingAndValidation`, `ValidationError`, and the `FieldError` type are available
