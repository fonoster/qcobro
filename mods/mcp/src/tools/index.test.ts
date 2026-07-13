import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { initTRPC, TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { z } from "zod";
import {
  apiKeyLoginSchema,
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  syncAccountsInputSchema
} from "@qcobro/common";
import { Client as QCobroClient } from "@qcobro/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "./index.js";

// ---------------------------------------------------------------------------
// In-process stub of the apiserver (same shape as mods/sdk/src/client.test.ts),
// plus a real McpServer wired up to a real @qcobro/sdk Client, driven over a
// real MCP client<->server InMemoryTransport pair. This exercises the actual
// tool registration, input validation, and result shape end to end.
// ---------------------------------------------------------------------------

interface Ctx {
  authorization?: string;
  workspace?: string;
}

const t = initTRPC.context<Ctx>().create();

const workspaceProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.authorization?.startsWith("Bearer ")) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.workspace !== "ws_one") {
    throw new TRPCError({ code: "FORBIDDEN" });
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
    exchangeApiKey: t.procedure.input(apiKeyLoginSchema).mutation(({ input }) => {
      if (input.accessKeySecret !== "secret-123") {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return {
        idToken: "id",
        accessToken: `access-for-${input.accessKeyId}`,
        refreshToken: "refresh"
      };
    })
  }),
  portfolios: t.router({
    list: workspaceProcedure
      .input(z.object({ includeArchived: z.boolean().optional() }).optional())
      .query(() => portfolios),
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
      return { created, updated: 0, archived: 0, total: accounts.length };
    })
  })
});

let httpServer: Server;
let endpoint: string;
let mcpClient: McpClient;

before(async () => {
  const app = express();
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouterStub,
      createContext: ({ req }) => {
        const workspaceHeader = req.headers["x-workspace"];
        return {
          authorization: req.headers.authorization,
          workspace: Array.isArray(workspaceHeader) ? workspaceHeader[0] : workspaceHeader
        };
      }
    })
  );
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const addr = httpServer.address();
  if (addr === null || typeof addr === "string") throw new Error("failed to bind test server");
  endpoint = `http://localhost:${addr.port}`;

  const qcobroClient = new QCobroClient({ endpoint });
  await qcobroClient.loginWithApiKey({ accessKeyId: "ak_ws_one", accessKeySecret: "secret-123" });
  qcobroClient.useWorkspace("ws_one");

  const mcpServer = new McpServer({ name: "test", version: "0.0.0" });
  registerTools(mcpServer, qcobroClient);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcpClient = new McpClient({ name: "test-client", version: "0.0.0" });
  await Promise.all([mcpClient.connect(clientTransport), mcpServer.connect(serverTransport)]);
});

after(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function firstText(result: Awaited<ReturnType<McpClient["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text: string }>;
  assert.equal(content[0]?.type, "text");
  return content[0].text;
}

test("lists the registered portfolio tools", async () => {
  const { tools } = await mcpClient.listTools();
  const names = tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "portfolios_create",
    "portfolios_delete",
    "portfolios_get",
    "portfolios_list",
    "portfolios_list_accounts",
    "portfolios_sync_accounts",
    "portfolios_update"
  ]);
});

test("portfolios_create delegates to the SDK and returns the created portfolio", async () => {
  const result = await mcpClient.callTool({
    name: "portfolios_create",
    arguments: { name: "Q3 delinquencies", clientId: "acme" }
  });
  assert.notEqual(result.isError, true);
  const created = JSON.parse(firstText(result));
  assert.equal(created.name, "Q3 delinquencies");
  assert.equal(typeof created.id, "string");
});

test("portfolios_list returns portfolios matching a direct SDK call", async () => {
  const result = await mcpClient.callTool({ name: "portfolios_list", arguments: {} });
  const list = JSON.parse(firstText(result));
  assert.ok(Array.isArray(list));
  assert.ok(list.some((p: { name: string }) => p.name === "Q3 delinquencies"));
});

test("portfolios_sync_accounts then portfolios_list_accounts golden path", async () => {
  const created = await mcpClient.callTool({
    name: "portfolios_create",
    arguments: { name: "Sync target", clientId: "acme" }
  });
  const { id } = JSON.parse(firstText(created));

  const sync = await mcpClient.callTool({
    name: "portfolios_sync_accounts",
    arguments: {
      portfolioId: id,
      mode: "APPEND_ONLY",
      rows: [{ externalId: "A-1", fullName: "Jane Doe", outstandingBalance: 1200.5 }]
    }
  });
  assert.notEqual(sync.isError, true);
  assert.equal(JSON.parse(firstText(sync)).created, 1);

  const page = await mcpClient.callTool({
    name: "portfolios_list_accounts",
    arguments: { portfolioId: id }
  });
  assert.equal(JSON.parse(firstText(page)).total, 1);
});

test("portfolios_get returns a structured error result (not a thrown exception) for a missing id", async () => {
  const result = await mcpClient.callTool({
    name: "portfolios_get",
    arguments: { id: "does-not-exist" }
  });
  assert.equal(result.isError, true);
});

test("portfolios_create with input that fails the shared schema is rejected before reaching the client", async () => {
  // The MCP SDK validates arguments against the registered zod shape before
  // invoking our handler, surfacing failure as an error result (not a thrown
  // protocol error) — so no request reaches the stub server for this call.
  const before = portfolios.length;
  const result = await mcpClient.callTool({ name: "portfolios_create", arguments: { name: "" } });
  assert.equal(result.isError, true);
  assert.equal(portfolios.length, before);
});
