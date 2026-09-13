import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAuthTokenFailure } from "./fonosterAuthErrors.js";

/**
 * A memoized login that has already succeeded is never re-checked on its own — only a call
 * made through it can discover the underlying token has gone bad. These cases decide which
 * failures should force that re-login and which shouldn't (an ordinary transport blip must
 * not trigger one on every call).
 */
describe("isAuthTokenFailure", () => {
  it("is true for UNAUTHENTICATED — the token was rejected outright", () => {
    assert.equal(isAuthTokenFailure({ code: 16, message: "Invalid or expired token" }), true);
  });

  it("is true for UNAVAILABLE whose message names a failed token refresh", () => {
    assert.equal(
      isAuthTokenFailure({
        code: 14,
        message: "Failed to refresh the access token: 13 INTERNAL: Internal server error"
      }),
      true
    );
  });

  it("is false for an ordinary UNAVAILABLE (transport/connectivity, not auth)", () => {
    assert.equal(isAuthTokenFailure({ code: 14, message: "fonoster unavailable" }), false);
  });

  it("is false for unrelated gRPC codes", () => {
    assert.equal(isAuthTokenFailure({ code: 3, message: "invalid 'to' number" }), false);
  });

  it("is false for a non-gRPC error (e.g. a timeout Error)", () => {
    assert.equal(isAuthTokenFailure(new Error("Fonoster getCall timed out")), false);
  });
});
