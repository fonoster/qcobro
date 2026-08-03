import { z } from "zod";
import { ValidationError } from "@qcobro/common";

/** Validate `input` against `schema`, throwing a structured {@link ValidationError} on failure. */
export function parse<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}
