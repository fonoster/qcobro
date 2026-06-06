import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ValidationError } from "./ValidationError.js";

const schema = z.object({ name: z.string().min(1), age: z.number() });

function zodErrorFor(input: unknown): z.ZodError {
  const result = schema.safeParse(input);
  assert.equal(result.success, false);
  return (result as { success: false; error: z.ZodError }).error;
}

describe("ValidationError", () => {
  it("exposes a stable code and field-level errors", () => {
    const error = new ValidationError(zodErrorFor({ name: "", age: "nope" }));

    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(error.name, "ValidationError");
    assert.ok(error instanceof Error);

    const fields = error.fieldErrors.map((f) => f.field);
    assert.ok(fields.includes("name"));
    assert.ok(fields.includes("age"));
    for (const fieldError of error.fieldErrors) {
      assert.equal(typeof fieldError.message, "string");
      assert.equal(typeof fieldError.code, "string");
    }
  });

  it("serializes to a JSON shape for API responses", () => {
    const error = new ValidationError(zodErrorFor({ name: "", age: 1 }));
    const json = error.toJSON();

    assert.deepEqual(Object.keys(json).sort(), ["code", "fieldErrors", "message"]);
    assert.equal(json.code, "VALIDATION_ERROR");
  });
});
