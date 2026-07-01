import type { z } from "zod";

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

/**
 * Thrown when client-side input validation fails before a request is sent.
 * Carries structured, field-level details from the Zod schema parse.
 */
export class ValidationError extends Error {
  public readonly code = "VALIDATION_ERROR";
  public readonly fieldErrors: FieldError[];
  public readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    const fieldErrors = ValidationError.extractFieldErrors(zodError);
    super(ValidationError.formatMessage(fieldErrors));
    this.name = "ValidationError";
    this.zodError = zodError;
    this.fieldErrors = fieldErrors;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  private static extractFieldErrors(zodError: z.ZodError): FieldError[] {
    return zodError.issues.map((issue) => ({
      field: issue.path.join(".") || "root",
      message: issue.message,
      code: issue.code
    }));
  }

  private static formatMessage(fieldErrors: FieldError[]): string {
    if (fieldErrors.length === 0) return "Validation failed";
    if (fieldErrors.length === 1) {
      const { field, message } = fieldErrors[0];
      return field === "root" ? message : `${field}: ${message}`;
    }
    return (
      "Validation failed: " +
      fieldErrors
        .map(({ field, message }) => (field === "root" ? message : `${field}: ${message}`))
        .join("; ")
    );
  }

  toJSON() {
    return { code: this.code, message: this.message, fieldErrors: this.fieldErrors };
  }
}
