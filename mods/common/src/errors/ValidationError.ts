import type { z } from "zod";

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

/**
 * Wraps a Zod validation error with structured, field-level details suitable
 * for API responses.
 */
export class ValidationError extends Error {
  public readonly code = "VALIDATION_ERROR";
  public readonly fieldErrors: FieldError[];
  public readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    const fieldErrors = ValidationError.extractFieldErrors(zodError);
    const message = ValidationError.formatMessage(fieldErrors);

    super(message);
    this.name = "ValidationError";
    this.zodError = zodError;
    this.fieldErrors = fieldErrors;

    // Maintains proper stack trace for where the error was thrown (V8 engines).
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
    if (fieldErrors.length === 0) {
      return "Validation failed";
    }

    if (fieldErrors.length === 1) {
      const { field, message } = fieldErrors[0];
      return field === "root" ? message : `${field}: ${message}`;
    }

    const details = fieldErrors
      .map(({ field, message }) => (field === "root" ? message : `${field}: ${message}`))
      .join("; ");

    return `Validation failed: ${details}`;
  }

  /**
   * Returns a JSON-serializable representation for API responses.
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      fieldErrors: this.fieldErrors
    };
  }
}
