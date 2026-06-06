## 1. Error type

- [x] 1.1 Add `mods/common/src/errors/ValidationError.ts` with `ValidationError` (code, message, `fieldErrors`, `zodError`, `toJSON()`) and the `FieldError` type
- [x] 1.2 Add `mods/common/src/errors/index.ts` barrel exporting `ValidationError` and `FieldError`

## 2. Validation wrapper

- [x] 2.1 Add `mods/common/src/utils/withErrorHandlingAndValidation.ts` that validates input via `safeParse` and throws `ValidationError` on failure
- [x] 2.2 Add `mods/common/src/utils/index.ts` barrel exporting `withErrorHandlingAndValidation`

## 3. Package wiring

- [x] 3.1 Export the errors and utils barrels from `mods/common/src/index.ts`
- [x] 3.2 Verify `npm run build` and `npm run typecheck` succeed for `common` and the workspace

## 4. Tests

- [x] 4.1 Add unit tests covering: valid input passes through; invalid input throws `ValidationError` and skips the inner fn; `fieldErrors` and `toJSON()` shape
- [x] 4.2 Verify the tests pass
