# @qcobro/sdk

A developer-friendly TypeScript SDK for the [QCobro](https://qcobro.com) API. It wraps the
server's tRPC interface behind an ergonomic, fully-typed `Client` so you can manage QCobro
resources without touching transport details.

This release covers **portfolios**, including account synchronization. More resources land in
follow-up releases.

## Install

```bash
npm install @qcobro/sdk
```

Requires a runtime with a global `fetch` (Node ≥18 or a modern browser). For older runtimes,
pass a `fetch` polyfill via the `fetch` option.

## Quick start

```ts
import { Client } from "@qcobro/sdk";

const client = new Client({ endpoint: "https://api.qcobro.com" });

// Authenticate and pick the workspace to act in.
await client.login({ email: "me@acme.com", password: process.env.QCOBRO_PASSWORD! });
client.useWorkspace("WO7f3a92b1c4d5e6f"); // workspace accessKeyId from the QCobro console

// ...or, for unattended/server-to-server integrations, use a workspace API key:
await client.loginWithApiKey({
  accessKeyId: "WO4e2c8d1a9b3f5c7e",
  accessKeySecret: process.env.QCOBRO_API_SECRET!
});

// Manage portfolios.
const portfolio = await client.portfolios.create({
  name: "Q3 delinquencies",
  clientId: "acme",
  currency: "USD"
});

const { items, total } = await client.portfolios.listAccounts({ portfolioId: portfolio.id });

await client.portfolios.syncAccounts({
  portfolioId: portfolio.id,
  mode: "APPEND_ONLY",
  rows: [{ externalId: "A-1", fullName: "Jane Doe", outstandingBalance: 1200.5 }]
});
```

## Authentication & tokens

Authenticate one of two ways:

- `login({ email, password })` — interactive credentials login (returns id/access/refresh tokens).
- `loginWithApiKey({ accessKeyId, accessKeySecret })` — a workspace API key, for unattended
  server-to-server use where there's no human to type a password.

The `Client` holds tokens **in memory**. Persisting them (so a session survives a restart) is
your responsibility:

```ts
// Save after login...
const tokens = client.getTokens();
// ...and restore later.
const client = new Client({ endpoint }).setTokens(tokens);

// Refresh an expired access token.
await client.refresh();
```

**Auto-refresh.** By default, if a call returns `UNAUTHORIZED` and a refresh token is held, the
client refreshes the access token **once** and replays the request transparently — concurrent
failures share a single refresh. If the refresh itself fails, the original `UNAUTHORIZED` is
surfaced. Disable it with `new Client({ endpoint, autoRefresh: false })`.

## Validation & errors

Inputs are validated client-side against the shared QCobro schemas **before** a request is
sent. Invalid input throws a `ValidationError` with field-level details, and no network call is
made. Server-side authorization failures (e.g. an unauthenticated or wrong-workspace call)
surface as the server's error.

```ts
import { ValidationError } from "@qcobro/sdk";

try {
  await client.portfolios.create({ name: "", clientId: "acme", currency: "USD" });
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(err.fieldErrors); // [{ field: "name", message: "...", code: "..." }]
  }
}
```

## API reference

Generate the markdown API reference with:

```bash
npm run docs
```

Output lands in `docs/`.
