import { z } from "zod";
import { ValidationError } from "../errors/ValidationError.js";

/**
 * Wraps an async function with Zod schema validation.
 *
 * The returned function validates its input against `schema` before calling
 * `fn`. Valid input is passed through as parsed, typed data; invalid input
 * throws a {@link ValidationError} and `fn` is never invoked.
 *
 * @example
 * ```typescript
 * const createCustomer = withErrorHandlingAndValidation(
 *   async (params: CreateCustomerInput) => client.customer.create({ data: params }),
 *   createCustomerSchema
 * );
 * ```
 */
export function withErrorHandlingAndValidation<TSchema extends z.ZodType, TResult>(
  fn: (params: z.infer<TSchema>) => Promise<TResult>,
  schema: TSchema
): (params: unknown) => Promise<TResult> {
  return async (params: unknown) => {
    const result = schema.safeParse(params);

    if (!result.success) {
      throw new ValidationError(result.error);
    }

    return fn(result.data);
  };
}
