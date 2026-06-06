## Context

QCobro adopts the validated-function pattern (DI builder + Zod validation wrapper) as a coding
convention. This change adds the two `@qcobro/common` utilities the pattern needs. The
implementation is small and well understood — it is ported from a proven implementation in a
sibling project (mikro) and adapted to QCobro's `zod` import and package layout.

## Goals / Non-Goals

**Goals:**

- Provide `withErrorHandlingAndValidation` and `ValidationError` in `@qcobro/common`.
- Keep them framework-agnostic so any layer (tRPC procedures, scripts, services) can use them.

**Non-Goals:**

- Rewriting existing code to use the pattern (there are no domain functions yet).
- Mapping `ValidationError` onto tRPC error shapes — that wiring belongs with the first feature
  that needs it.

## Decisions

**Throw, don't return.** The wrapper throws `ValidationError` on invalid input rather than
returning a result union. Callers already use try/catch around I/O, and tRPC translates thrown
errors into responses. Alternative: a `Result<T, E>` return — rejected as heavier ceremony for
the common case.

**Structured field errors.** `ValidationError` exposes `fieldErrors: { field, message, code }[]`
and `toJSON()` so API layers can surface per-field messages without re-parsing the `ZodError`.
The original `zodError` is retained for debugging.

**Import `zod` (v4).** Use `import { z } from "zod"` consistent with the rest of `common`
(zod ^4), rather than the transitional `zod/v4` subpath.

## Risks / Trade-offs

- **Zod major shifts** → `ValidationError` reads `error.issues` (stable in zod 4). Pinned via the
  existing `zod` dependency; covered by tests for both success and failure paths.

## Open Questions

- None.
