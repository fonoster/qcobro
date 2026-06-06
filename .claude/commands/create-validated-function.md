---
name: "Create Validated Function"
description: Scaffold a function using the validated-function pattern (DI + Zod validation + error handling)
---

# Create Validated Function

Create a new function using the validation and error-handling pattern with Zod schemas.

## Pattern Overview

A builder-style approach:

1. **Outer function** (`createXxx`) accepts dependencies as parameters (dependency injection).
2. **Inner function** (`fn`) contains the actual business logic with typed parameters.
3. **Wrapper** (`withErrorHandlingAndValidation`) handles validation and errors.

This enables **dependency injection**, making functions easy to test by swapping real
dependencies with mocks.

## Instructions

1. **Identify or create the Zod schema** in `@qcobro/common`:
   - Check if a schema already exists in `mods/common/src/schemas/`.
   - If not, create a new schema file following the naming convention: `<domain>.ts`.
   - Export the schema and its inferred type from `mods/common/src/schemas/index.ts`.
   - Export from `mods/common/src/index.ts`.

2. **Use existing client interfaces** from `@qcobro/common`:
   - Client interfaces live in `mods/common/src/types/`.
   - Import them: `import type { CustomerClient } from "@qcobro/common"`.
   - If a new interface is needed, add it to the types folder.

3. **Create the function file** following the naming pattern `create<FunctionName>.ts`:

   ```typescript
   import {
     withErrorHandlingAndValidation,
     <schemaName>,
     type <InputType>,
     type <ClientType>
   } from "@qcobro/common";

   export function create<FunctionName>(client: <ClientType>) {
     const fn = async (params: <InputType>) => {
       // Business logic here using the injected client
       return client.doSomething(params);
     };

     return withErrorHandlingAndValidation(fn, <schemaName>);
   }
   ```

4. **Export the function** from the appropriate barrel file or index.

## Example: Customer Operations

### Using Shared Types

```typescript
import {
  withErrorHandlingAndValidation,
  createCustomerSchema,
  type CreateCustomerInput,
  type CustomerClient
} from "@qcobro/common";

export function createCreateCustomer(client: CustomerClient) {
  const fn = async (params: CreateCustomerInput) => {
    return client.customer.create({ data: params });
  };

  return withErrorHandlingAndValidation(fn, createCustomerSchema);
}
```

### Production Usage

```typescript
import { prisma } from "./db.js";
import { createCreateCustomer } from "./customers/createCreateCustomer.js";

// Inject the real database client
const createCustomer = createCreateCustomer(prisma);

// Validates input and throws ValidationError if invalid
const customer = await createCustomer({
  name: "John Doe",
  phone: "+1234567890"
});
```

## Example: Custom Service Function

The pattern works for any function, not just database operations.

### Schema

```typescript
// mods/common/src/schemas/notification.ts
import { z } from "zod";

export const sendNotificationSchema = z.object({
  recipient: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(["low", "normal", "high"]).optional()
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
```

### Client Interface

```typescript
// mods/common/src/types/notification.ts
import type { SendNotificationInput } from "../schemas/notification.js";

export interface NotificationClient {
  send(params: SendNotificationInput): Promise<{ messageId: string }>;
}
```

## Testing

Inject a mock client and assert on validation + delegation:

```typescript
it("throws ValidationError and never calls the client on invalid input", async () => {
  const mockClient = { customer: { create: sinon.stub() } };
  const createCustomer = createCreateCustomer(mockClient);

  try {
    await createCustomer({ name: "" });
    expect.fail("Expected ValidationError to be thrown");
  } catch (error) {
    expect(error).to.be.instanceOf(ValidationError);
    expect(mockClient.customer.create.called).to.be.false;
  }
});
```

Benefits: testability (mocks, no live services), isolation, fast tests, predictable behavior,
and guaranteed validation coverage (invalid input never reaches the client).

## Error Handling

The `withErrorHandlingAndValidation` wrapper:

- Validates input against the Zod schema using `safeParse`.
- Throws `ValidationError` with field-level errors if validation fails.
- Passes validated, typed data to the inner function.

`ValidationError` includes:

- `message`: human-readable message.
- `fieldErrors`: array of `{ field, message, code }`.
- `zodError`: original Zod error for debugging.
- `toJSON()`: serializable form for API responses.

## Files Reference

- Utility: `mods/common/src/utils/withErrorHandlingAndValidation.ts`
- Error: `mods/common/src/errors/ValidationError.ts`
- Schemas: `mods/common/src/schemas/`
- Client interfaces: `mods/common/src/types/`
