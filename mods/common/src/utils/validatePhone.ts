import { z } from "zod";
import { ValidationError } from "../errors/ValidationError.js";
import { phoneNumberSchema, type ValidatePhoneInput } from "../schemas/phone.js";
import { withErrorHandlingAndValidation } from "./withErrorHandlingAndValidation.js";
import { normalizePhoneE164 } from "./normalizePhone.js";

/**
 * Strict, throwing E.164 phone validator for input boundaries — account/CSV import today,
 * any future write path that persists a phone number tomorrow. A fresh implementation for
 * this repo (not ported from mikro, a separate repo), layered on top of the lenient,
 * non-throwing `normalizePhoneE164` (PR #62), which stays as-is for best-effort
 * inbound-webhook matching where "doesn't parse" must mean "no match," not a crash.
 *
 * Built as a validated function (factory + Zod schema + `withErrorHandlingAndValidation`)
 * per this repo's convention for input-validating operations — even with no injected
 * dependencies, this keeps the thrown error a structured `ValidationError` (the same shape
 * every other write-boundary in this codebase throws), so callers don't need a special case
 * for phone numbers specifically.
 */
export function createValidatePhoneE164() {
  const fn = async ({ phone }: ValidatePhoneInput): Promise<string> => {
    const normalized = normalizePhoneE164(phone);
    if (normalized) return normalized;

    throw new ValidationError(
      new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `"${phone}" is not a valid phone number`,
          path: ["phone"]
        }
      ])
    );
  };

  return withErrorHandlingAndValidation(fn, phoneNumberSchema);
}
