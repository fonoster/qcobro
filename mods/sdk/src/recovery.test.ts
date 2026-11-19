import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, ValidationError } from "./index.js";

interface Call {
  url: string;
  body: string | undefined;
}

// A `fetch` that records every request and answers it with an empty tRPC batch result, so
// a test can check which procedure was called and with what input.
function recordingFetch() {
  const calls: Call[] = [];
  const fetchImpl = (async (input: unknown, init?: { body?: unknown }) => {
    calls.push({
      url: String(input),
      body: init?.body === undefined ? undefined : String(init.body)
    });
    return new Response(JSON.stringify([{ result: { data: null } }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetchImpl };
}

function authedClient(fetchImpl: typeof globalThis.fetch) {
  return new Client({ endpoint: "http://localhost:1", fetch: fetchImpl })
    .setTokens({ accessToken: "test-token" })
    .useWorkspace("ws_test");
}

const period = { from: "2026-10-01", to: "2026-10-31" };

test("recovery.summary rejects an invalid date before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () => client.recovery.summary({ from: "2026-13-01", to: "2026-10-31" }),
    ValidationError
  );
  assert.equal(calls.length, 0);
});

test("recovery.breakdown rejects an unknown dimension before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    // @ts-expect-error - exercising a runtime-invalid dimension
    () => client.recovery.breakdown({ ...period, by: "DAYS" }),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.fieldErrors.some((f) => f.field === "by"));
      return true;
    }
  );
  assert.equal(calls.length, 0);
});

test("recovery.list rejects a limit above 200 before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(() => client.recovery.list({ ...period, limit: 500 }), ValidationError);
  assert.equal(calls.length, 0);
});

test("recovery.summary calls recovery.summary with the period", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await client.recovery.summary({ ...period, portfolioId: "p1" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/trpc\/recovery\.summary\?/);
  assert.match(decodeURIComponent(calls[0].url), /"portfolioId":"p1"/);
});

test("portfolios.listExits calls portfolios.listExits", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await client.portfolios.listExits({ portfolioId: "p1", reason: "UNKNOWN" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/trpc\/portfolios\.listExits\?/);
  assert.match(decodeURIComponent(calls[0].url), /"reason":"UNKNOWN"/);
});

test("portfolios.classifyExits calls portfolios.classifyExits with the exits", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);
  const exits = [
    { externalId: "C-0877", reason: "CAUGHT_UP" as const, missedInstallments: 2, termsAmount: 1500 }
  ];

  await client.portfolios.classifyExits({ portfolioId: "p1", exits });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/trpc\/portfolios\.classifyExits\?/);
  assert.deepEqual(JSON.parse(calls[0].body ?? "{}")["0"], { portfolioId: "p1", exits });
});

test("portfolios.classifyExits rejects a CAUGHT_UP exit without its installments before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () =>
      client.portfolios.classifyExits({
        portfolioId: "p1",
        exits: [{ externalId: "C-0877", reason: "CAUGHT_UP" }]
      }),
    ValidationError
  );
  assert.equal(calls.length, 0);
});

test("portfolios.syncAccounts forwards exits unchanged", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);
  const exits = [
    { externalId: "C-0877", reason: "PAID_OFF" as const, missedInstallments: 3, termsAmount: 2500 },
    { externalId: "C-0878", reason: "WRITTEN_OFF" as const }
  ];

  await client.portfolios.syncAccounts({
    portfolioId: "p1",
    mode: "UPDATE_EXISTING",
    rows: [],
    exits
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/trpc\/portfolios\.syncAccounts\?/);
  assert.deepEqual(JSON.parse(calls[0].body ?? "{}")["0"].exits, exits);
});
