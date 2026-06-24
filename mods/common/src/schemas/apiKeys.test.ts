import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApiKeySchema, apiKeyRefSchema } from "./apiKeys.js";

describe("createApiKeySchema", () => {
  it("defaults the role to admin with no expiry", () => {
    const parsed = createApiKeySchema.parse({});
    assert.equal(parsed.role, "WORKSPACE_ADMIN");
    assert.equal(parsed.expiresAt, undefined);
  });

  it("accepts an admin role with a future expiry", () => {
    const future = Date.now() + 86_400_000;
    const parsed = createApiKeySchema.parse({ role: "WORKSPACE_ADMIN", expiresAt: future });
    assert.equal(parsed.role, "WORKSPACE_ADMIN");
    assert.equal(parsed.expiresAt, future);
  });

  it("rejects member/owner roles — Identity only issues admin keys", () => {
    assert.equal(createApiKeySchema.safeParse({ role: "WORKSPACE_MEMBER" }).success, false);
    assert.equal(createApiKeySchema.safeParse({ role: "WORKSPACE_OWNER" }).success, false);
  });

  it("rejects an expiry in the past", () => {
    const result = createApiKeySchema.safeParse({ expiresAt: Date.now() - 1000 });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /future/);
    }
  });
});

describe("apiKeyRefSchema", () => {
  it("requires a non-empty ref", () => {
    assert.equal(apiKeyRefSchema.safeParse({ ref: "" }).success, false);
    assert.equal(apiKeyRefSchema.safeParse({ ref: "ak_1" }).success, true);
  });
});
