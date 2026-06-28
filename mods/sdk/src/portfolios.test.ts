import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, ValidationError } from "./index.js";

// A `fetch` that records every call. The SDK validates input before reaching
// the transport, so for invalid input this must never be invoked.
function recordingFetch() {
  const calls: string[] = [];
  const fetchImpl = (async (input: unknown) => {
    calls.push(String(input));
    throw new Error("network should not be reached for invalid input");
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetchImpl };
}

function authedClient(fetchImpl: typeof globalThis.fetch) {
  return new Client({ endpoint: "http://localhost:1", fetch: fetchImpl })
    .setTokens({ accessToken: "test-token" })
    .useWorkspace("ws_test");
}

test("create rejects empty name with ValidationError and sends no request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () => client.portfolios.create({ name: "", clientId: "acme" }),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.fieldErrors.some((f) => f.field === "name"));
      return true;
    }
  );
  assert.equal(calls.length, 0);
});

test("syncAccounts rejects an unknown mode before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () =>
      client.portfolios.syncAccounts({
        portfolioId: "p1",
        // @ts-expect-error - exercising a runtime-invalid mode
        mode: "MERGE",
        rows: [{ externalId: "a", fullName: "Jane", outstandingBalance: 10 }]
      }),
    ValidationError
  );
  assert.equal(calls.length, 0);
});

test("syncAccounts rejects an empty rows batch before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () => client.portfolios.syncAccounts({ portfolioId: "p1", mode: "APPEND_ONLY", rows: [] }),
    ValidationError
  );
  assert.equal(calls.length, 0);
});

test("get rejects an empty id before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(() => client.portfolios.get({ id: "" }), ValidationError);
  assert.equal(calls.length, 0);
});
