import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { initTRPC, TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { z } from "zod";
import {
  loginSchema,
  apiKeyLoginSchema,
  refreshTokenSchema,
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  syncAccountsInputSchema
} from "@qcobro/common";
import { Client } from "./index.js";

// ---------------------------------------------------------------------------
// In-process stub of the apiserver: a real express + tRPC server whose
// procedure names mirror the production `portfolios` + `auth` surface. The SDK
// is typed against the real AppRouter; at runtime it talks to this stub over
// the actual tRPC HTTP wire protocol, so these are genuine end-to-end tests of
// the SDK's transport, header injection, and validation — without a database.
// ---------------------------------------------------------------------------

const MEMBERSHIPS = new Set(["ws_one", "ws_two"]);

interface Ctx {
  authorization?: string;
  workspace?: string;
}

// Records the headers the server actually received on the most recent request.
let lastReceived: Ctx = {};

const t = initTRPC.context<Ctx>().create();

// Number of times the refresh procedure has been invoked (asserted by the
// auto-refresh tests to verify single-flight behavior).
let refreshCalls = 0;

const workspaceProcedure = t.procedure.use(({ ctx, next }) => {
  // A bearer token containing "expired" stands in for an expired access token.
  if (!ctx.authorization?.startsWith("Bearer ") || ctx.authorization.includes("expired")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or invalid bearer token" });
  }
  if (!ctx.workspace || !MEMBERSHIPS.has(ctx.workspace)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
  }
  return next();
});

interface StoredPortfolio {
  id: string;
  name: string;
  clientId: string;
  archivedAt: string | null;
}
const portfolios: StoredPortfolio[] = [];
const accounts: { portfolioId: string; externalId: string; fullName: string }[] = [];
let seq = 0;

const appRouterStub = t.router({
  auth: t.router({
    login: t.procedure.input(loginSchema).mutation(({ input }) => ({
      idToken: "id-token",
      accessToken: `access-for-${input.email}`,
      refreshToken: "refresh-token"
    })),
    refresh: t.procedure.input(refreshTokenSchema).mutation(({ input }) => {
      refreshCalls++;
      if (input.refreshToken === "bad-refresh") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid refresh token" });
      }
      return {
        idToken: "id-token",
        accessToken: "access-refreshed",
        refreshToken: "refresh-token"
      };
    }),
    exchangeApiKey: t.procedure.input(apiKeyLoginSchema).mutation(({ input }) => {
      if (input.accessKeySecret !== "secret-123") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid API key" });
      }
      return {
        idToken: "id-token",
        accessToken: `access-for-${input.accessKeyId}`,
        refreshToken: "refresh-token"
      };
    })
  }),
  portfolios: t.router({
    list: workspaceProcedure
      .input(z.object({ includeArchived: z.boolean().optional() }).optional())
      .query(({ input }) =>
        portfolios.filter((p) => (input?.includeArchived ? true : p.archivedAt === null))
      ),
    get: workspaceProcedure.input(z.object({ id: z.string() })).query(({ input }) => {
      const found = portfolios.find((p) => p.id === input.id);
      if (!found) throw new TRPCError({ code: "NOT_FOUND" });
      return found;
    }),
    create: workspaceProcedure.input(createPortfolioSchema).mutation(({ input }) => {
      const row: StoredPortfolio = { id: `p_${++seq}`, archivedAt: null, ...input };
      portfolios.push(row);
      return row;
    }),
    update: workspaceProcedure.input(updatePortfolioSchema).mutation(({ input }) => {
      const row = portfolios.find((p) => p.id === input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.name !== undefined) row.name = input.name;
      if (input.archived !== undefined) row.archivedAt = input.archived ? "now" : null;
      return row;
    }),
    delete: workspaceProcedure.input(deletePortfolioSchema).mutation(({ input }) => {
      const i = portfolios.findIndex((p) => p.id === input.id);
      if (i >= 0) portfolios.splice(i, 1);
      return { id: input.id };
    }),
    listAccounts: workspaceProcedure
      .input(
        z.object({
          portfolioId: z.string(),
          limit: z.number().optional(),
          offset: z.number().optional()
        })
      )
      .query(({ input }) => {
        const items = accounts.filter((a) => a.portfolioId === input.portfolioId);
        return { items, total: items.length };
      }),
    syncAccounts: workspaceProcedure.input(syncAccountsInputSchema).mutation(({ input }) => {
      let created = 0;
      for (const r of input.rows) {
        accounts.push({
          portfolioId: input.portfolioId,
          externalId: r.externalId,
          fullName: r.fullName
        });
        created++;
      }
      const total = accounts.filter((a) => a.portfolioId === input.portfolioId).length;
      return { created, updated: 0, archived: 0, total };
    })
  })
});

let server: Server;
let endpoint: string;

before(async () => {
  const app = express();
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouterStub,
      createContext: ({ req }) => {
        const workspaceHeader = req.headers["x-workspace"];
        lastReceived = {
          authorization: req.headers.authorization,
          workspace: Array.isArray(workspaceHeader) ? workspaceHeader[0] : workspaceHeader
        };
        return lastReceived;
      }
    })
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("failed to bind test server");
  endpoint = `http://localhost:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("defaults the endpoint to https://api.qcobro.com when none is given", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: unknown) => {
    calls.push(String(input));
    throw new Error("stop after recording the URL");
  }) as unknown as typeof globalThis.fetch;

  const client = new Client({ fetch: fetchImpl })
    .setTokens({ accessToken: "t" })
    .useWorkspace("ws_test");

  await client.portfolios.list().catch(() => {});
  assert.ok(calls.length > 0, "transport was not reached");
  assert.ok(
    calls[0].startsWith("https://api.qcobro.com/trpc"),
    `expected default endpoint, got ${calls[0]}`
  );
});

test("login obtains and stores tokens", async () => {
  const client = new Client({ endpoint });
  const tokens = await client.login({ email: "me@acme.com", password: "secret" });
  assert.equal(tokens.accessToken, "access-for-me@acme.com");
  assert.equal(client.getTokens().accessToken, "access-for-me@acme.com");
});

test("loginWithApiKey obtains and stores tokens", async () => {
  const client = new Client({ endpoint });
  const tokens = await client.loginWithApiKey({
    accessKeyId: "ak_ws_one",
    accessKeySecret: "secret-123"
  });
  assert.equal(tokens.accessToken, "access-for-ak_ws_one");
  assert.equal(client.getTokens().accessToken, "access-for-ak_ws_one");
});

test("loginWithApiKey rejects an invalid secret", async () => {
  const client = new Client({ endpoint });
  await assert.rejects(
    () => client.loginWithApiKey({ accessKeyId: "ak_ws_one", accessKeySecret: "wrong" }),
    (err: unknown) => {
      assert.equal((err as { data?: { code?: string } }).data?.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("API-key auth then a workspace-scoped call works end to end", async () => {
  const client = new Client({ endpoint });
  await client.loginWithApiKey({ accessKeyId: "ak_ws_one", accessKeySecret: "secret-123" });
  client.useWorkspace("ws_one");
  await client.portfolios.list();
  assert.equal(lastReceived.authorization, "Bearer access-for-ak_ws_one");
  assert.equal(lastReceived.workspace, "ws_one");
});

test("authenticated, workspace-scoped request carries bearer + workspace headers", async () => {
  const client = new Client({ endpoint });
  await client.login({ email: "me@acme.com", password: "secret" });
  client.useWorkspace("ws_one");

  await client.portfolios.list();
  assert.equal(lastReceived.authorization, "Bearer access-for-me@acme.com");
  assert.equal(lastReceived.workspace, "ws_one");
});

test("changing the workspace after login applies to the next call", async () => {
  const client = new Client({ endpoint });
  await client.login({ email: "me@acme.com", password: "secret" });

  client.useWorkspace("ws_one");
  await client.portfolios.list();
  assert.equal(lastReceived.workspace, "ws_one");

  client.useWorkspace("ws_two");
  await client.portfolios.list();
  assert.equal(lastReceived.workspace, "ws_two");
});

test("refresh replaces the access token", async () => {
  const client = new Client({ endpoint });
  await client.login({ email: "me@acme.com", password: "secret" });
  await client.refresh();
  assert.equal(client.getTokens().accessToken, "access-refreshed");
});

test("an unauthenticated workspace-scoped call is rejected", async () => {
  const client = new Client({ endpoint }).useWorkspace("ws_one");
  await assert.rejects(
    () => client.portfolios.list(),
    (err: unknown) => {
      assert.equal((err as { data?: { code?: string } }).data?.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("a wrong-workspace call is rejected", async () => {
  const client = new Client({ endpoint });
  await client.login({ email: "me@acme.com", password: "secret" });
  client.useWorkspace("ws_not_a_member");
  await assert.rejects(
    () => client.portfolios.list(),
    (err: unknown) => {
      assert.equal((err as { data?: { code?: string } }).data?.code, "FORBIDDEN");
      return true;
    }
  );
});

test("auto-refresh: an expired access token is refreshed and the call replayed", async () => {
  const client = new Client({ endpoint })
    .setTokens({ accessToken: "expired-token", refreshToken: "good-refresh" })
    .useWorkspace("ws_one");

  const before = refreshCalls;
  const result = await client.portfolios.list(); // 401 -> refresh -> retry -> ok
  assert.ok(Array.isArray(result));
  assert.equal(client.getTokens().accessToken, "access-refreshed");
  assert.equal(refreshCalls - before, 1);
});

test("auto-refresh: concurrent expired calls refresh only once", async () => {
  const client = new Client({ endpoint })
    .setTokens({ accessToken: "expired-token", refreshToken: "good-refresh" })
    .useWorkspace("ws_one");

  const before = refreshCalls;
  await Promise.all([client.portfolios.list(), client.portfolios.list(), client.portfolios.list()]);
  assert.equal(refreshCalls - before, 1);
});

test("auto-refresh: a failed refresh surfaces the original UNAUTHORIZED", async () => {
  const client = new Client({ endpoint })
    .setTokens({ accessToken: "expired-token", refreshToken: "bad-refresh" })
    .useWorkspace("ws_one");

  await assert.rejects(
    () => client.portfolios.list(),
    (err: unknown) => {
      assert.equal((err as { data?: { code?: string } }).data?.code, "UNAUTHORIZED");
      return true;
    }
  );
});

test("auto-refresh disabled: UNAUTHORIZED surfaces without refreshing", async () => {
  const client = new Client({ endpoint, autoRefresh: false })
    .setTokens({ accessToken: "expired-token", refreshToken: "good-refresh" })
    .useWorkspace("ws_one");

  const before = refreshCalls;
  await assert.rejects(
    () => client.portfolios.list(),
    (err: unknown) => {
      assert.equal((err as { data?: { code?: string } }).data?.code, "UNAUTHORIZED");
      return true;
    }
  );
  assert.equal(refreshCalls - before, 0);
});

test("golden path: login → useWorkspace → create → list → syncAccounts → listAccounts", async () => {
  const client = new Client({ endpoint });
  await client.login({ email: "ops@acme.com", password: "secret" });
  client.useWorkspace("ws_one");

  const created = await client.portfolios.create({
    name: "Q3 delinquencies",
    clientId: "acme"
  });
  assert.equal(typeof created.id, "string");
  assert.equal(created.name, "Q3 delinquencies");

  const list = await client.portfolios.list();
  assert.ok(list.some((p) => p.id === created.id));

  const sync = await client.portfolios.syncAccounts({
    portfolioId: created.id,
    mode: "APPEND_ONLY",
    rows: [
      { externalId: "A-1", fullName: "Jane Doe", outstandingBalance: 1200.5 },
      { externalId: "A-2", fullName: "John Roe", outstandingBalance: 75 }
    ]
  });
  assert.equal(sync.created, 2);
  assert.ok(sync.total >= 2);

  const page = await client.portfolios.listAccounts({ portfolioId: created.id });
  assert.equal(page.total, 2);
});
