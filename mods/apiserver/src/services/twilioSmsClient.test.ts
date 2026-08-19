import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSmsStatusCallbackUrl, classifySmsError } from "./twilioSmsClient.js";

describe("buildSmsStatusCallbackUrl", () => {
  it("builds the callback URL when a webhookBaseUrl is configured", () => {
    assert.equal(
      buildSmsStatusCallbackUrl("https://qcobro.example.com"),
      "https://qcobro.example.com/api/sms/events"
    );
  });

  it("strips a trailing slash before appending the path", () => {
    assert.equal(
      buildSmsStatusCallbackUrl("https://qcobro.example.com/"),
      "https://qcobro.example.com/api/sms/events"
    );
  });

  it("returns undefined when no webhookBaseUrl is configured", () => {
    assert.equal(buildSmsStatusCallbackUrl(undefined), undefined);
  });
});

describe("classifySmsError", () => {
  it("classifies a 400 invalid-number rejection as DELIVERY_REJECTED", () => {
    const err = classifySmsError({
      status: 400,
      code: 21211,
      message: "Invalid 'To' Phone Number"
    });
    assert.equal(err.kind, "DELIVERY_REJECTED");
  });

  it("classifies a 401 auth failure as SYSTEM_ERROR", () => {
    const err = classifySmsError({ status: 401, code: 20003, message: "Authentication Error" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("classifies a 403 permission failure as SYSTEM_ERROR", () => {
    const err = classifySmsError({ status: 403, message: "Permission denied" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("classifies a 429 rate limit as SYSTEM_ERROR", () => {
    const err = classifySmsError({ status: 429, message: "Too Many Requests" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("classifies a 5xx outage as SYSTEM_ERROR", () => {
    const err = classifySmsError({ status: 503, message: "Service unavailable" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("falls back to SYSTEM_ERROR for an unclassifiable error (e.g. a timeout)", () => {
    const err = classifySmsError(new Error("Twilio messages.create timed out"));
    assert.equal(err.kind, "SYSTEM_ERROR");
  });
});
