import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createValidatePhoneE164 } from "./validatePhone.js";
import { ValidationError } from "../errors/ValidationError.js";

describe("createValidatePhoneE164", () => {
  it("normalizes a valid international number to E.164", async () => {
    const validatePhone = createValidatePhoneE164();

    const result = await validatePhone({ phone: "+1 (809) 123-4567" });

    assert.equal(result, "+18091234567");
  });

  it("normalizes a number missing the leading '+'", async () => {
    const validatePhone = createValidatePhoneE164();

    const result = await validatePhone({ phone: "18091234567" });

    assert.equal(result, "+18091234567");
  });

  it("throws a structured ValidationError for an unparseable phone number", async () => {
    const validatePhone = createValidatePhoneE164();

    await assert.rejects(
      () => validatePhone({ phone: "not-a-phone-number" }),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.equal(err.fieldErrors[0]?.field, "phone");
        return true;
      }
    );
  });

  it("throws a structured ValidationError (schema-level) for an empty string", async () => {
    const validatePhone = createValidatePhoneE164();

    await assert.rejects(() => validatePhone({ phone: "" }), ValidationError);
  });

  it("rejects malformed params shapes via the schema, never calling the normalizer", async () => {
    const validatePhone = createValidatePhoneE164();

    await assert.rejects(() => validatePhone({} as never), ValidationError);
  });
});
