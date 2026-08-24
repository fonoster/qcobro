import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TimeoutError, withTimeout } from "./withTimeout.js";

describe("withTimeout", () => {
  it("resolves with the promise's value when it settles before the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 200, "timed out");
    assert.equal(result, "ok");
  });

  it("rejects with the promise's own error when it rejects before the timeout", async () => {
    await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 200, "timed out"), /boom/);
  });

  it("rejects with a TimeoutError when the promise never settles in time", async () => {
    await assert.rejects(
      withTimeout(new Promise(() => {}), 20, "custom timeout message"),
      (err: unknown) => err instanceof TimeoutError && err.message === "custom timeout message"
    );
  });
});
