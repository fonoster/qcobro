## Why

The validated-function pattern is QCobro's preferred way to write input-validating service/data functions (recorded in `CLAUDE.md` and scaffolded by the `/create-validated-function` command). The pattern depends on two shared utilities — `withErrorHandlingAndValidation` and `ValidationError` — that do not yet exist in `@qcobro/common`. Adding them now means the first domain feature can adopt the pattern from day one.

## What Changes

- Add a `ValidationError` class to `@qcobro/common` that wraps a `ZodError` into structured, field-level errors with a stable `code`, a human-readable `message`, and a `toJSON()` for API responses.
- Add a `withErrorHandlingAndValidation` higher-order function to `@qcobro/common` that validates input against a Zod schema before invoking the wrapped function, throwing `ValidationError` on failure and passing typed data on success.
- Organize `mods/common/src` into `errors/` and `utils/` folders and export the new members from the package entry.

## Capabilities

### New Capabilities

- `validated-functions`: The shared validation wrapper and structured `ValidationError` that underpin the validated-function coding convention.

### Modified Capabilities

<!-- None — these utilities are new; the project-structure spec already allows common to host shared utilities. -->

## Impact

- **Code:** `mods/common/src/errors/`, `mods/common/src/utils/`, and the package entry (`src/index.ts`) gain exports. No breaking changes — purely additive.
- **Dependencies:** none beyond the existing `zod`.
- **Consumers:** future apiserver procedures (and any input-validating function) build on these utilities via the validated-function pattern.
