import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withErrorHandlingAndValidation } from "./withErrorHandlingAndValidation.js";
import { ValidationError } from "../errors/ValidationError.js";

const schema = z.object({ name: z.string().min(1) });

describe("withErrorHandlingAndValidation", () => {
  it("passes parsed, typed input to the wrapped function and returns its result", async () => {
    let received: { name: string } | null = null;
    const wrapped = withErrorHandlingAndValidation(async (params: { name: string }) => {
      received = params;
      return `hello ${params.name}`;
    }, schema);

    const result = await wrapped({ name: "Ada" });

    assert.equal(result, "hello Ada");
    assert.deepEqual(received, { name: "Ada" });
  });

  it("throws ValidationError and never calls the inner function on invalid input", async () => {
    let called = false;
    const wrapped = withErrorHandlingAndValidation(async (params: { name: string }) => {
      called = true;
      return params.name;
    }, schema);

    await assert.rejects(() => wrapped({ name: "" }), ValidationError);
    assert.equal(called, false);
  });
});
