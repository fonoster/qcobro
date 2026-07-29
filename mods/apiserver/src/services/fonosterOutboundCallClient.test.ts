import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyVoiceError } from "./fonosterOutboundCallClient.js";

describe("classifyVoiceError", () => {
  it("classifies INVALID_ARGUMENT (invalid destination) as DELIVERY_REJECTED", () => {
    const err = classifyVoiceError({ code: 3, message: "invalid 'to' number" });
    assert.equal(err.kind, "DELIVERY_REJECTED");
  });

  it("classifies FAILED_PRECONDITION (carrier rejected) as DELIVERY_REJECTED", () => {
    const err = classifyVoiceError({ code: 9, message: "carrier declined the call" });
    assert.equal(err.kind, "DELIVERY_REJECTED");
  });

  it("classifies UNAUTHENTICATED as SYSTEM_ERROR", () => {
    const err = classifyVoiceError({ code: 16, message: "invalid api key/secret" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("classifies UNAVAILABLE as SYSTEM_ERROR", () => {
    const err = classifyVoiceError({ code: 14, message: "fonoster unavailable" });
    assert.equal(err.kind, "SYSTEM_ERROR");
  });

  it("falls back to SYSTEM_ERROR for an unclassifiable error (e.g. a timeout)", () => {
    const err = classifyVoiceError(new Error("Fonoster createCall timed out"));
    assert.equal(err.kind, "SYSTEM_ERROR");
  });
});
