import { z } from "zod";
import { ValidationError } from "@qcobro/common";

/**
 * Builds a {@link ValidationError} for a business-rule rejection (e.g. an
 * immutable field changed, a cross-workspace reference) so the API surfaces
 * the same structured, field-level shape as schema validation failures.
 */
export function businessError(field: string, message: string): ValidationError {
  const issue = {
    code: "custom",
    path: field ? [field] : [],
    message
  } as z.core.$ZodIssue;
  return new ValidationError(new z.ZodError([issue]));
}
