import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { initTRPC } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { z } from "zod";
import {
  agentTypeSchema,
  createAgentTemplateSchema,
  syncAgentTemplateSchema
} from "@qcobro/common";
import { Client, ValidationError } from "./index.js";

// ---------------------------------------------------------------------------
// Unit-style tests: client-side validation never reaches the network.
// ---------------------------------------------------------------------------

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

test("create rejects a VOICE_AI payload missing a required field", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () =>
      client.agentTemplates.create({
        type: "VOICE_AI",
        name: "Cobranza suave",
        // @ts-expect-error - exercising a runtime-missing required field
        voice: undefined,
        systemPrompt: "Sé amable y directo.",
        language: "es"
      }),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.fieldErrors.some((f) => f.field.includes("voice")));
      return true;
    }
  );
  assert.equal(calls.length, 0);
});

test("create rejects an unknown agent type before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(
    () =>
      client.agentTemplates.create({
        // @ts-expect-error - exercising a runtime-invalid type
        type: "FAX",
        name: "Cobranza"
      }),
    ValidationError
  );
  assert.equal(calls.length, 0);
});

test("sync rejects an empty id before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(() => client.agentTemplates.sync({ id: "" }), ValidationError);
  assert.equal(calls.length, 0);
});

test("get rejects an empty id before any request", async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = authedClient(fetchImpl);

  await assert.rejects(() => client.agentTemplates.get({ id: "" }), ValidationError);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// Golden path: in-process stub of the apiserver's agentTemplates router,
// exercising the real tRPC wire protocol end to end (no database).
// ---------------------------------------------------------------------------

interface StoredTemplate {
  id: string;
  name: string;
  type: string;
  fonosterAppRef: string | null;
  archivedAt: string | null;
}

const templates: StoredTemplate[] = [];
let seq = 0;

const t = initTRPC.create();

const appRouterStub = t.router({
  agentTemplates: t.router({
    list: t.procedure
      .input(
        z
          .object({ type: agentTypeSchema.optional(), includeArchived: z.boolean().optional() })
          .optional()
      )
      .query(({ input }) =>
        templates.filter((tpl) => (input?.includeArchived ? true : tpl.archivedAt === null))
      ),
    get: t.procedure.input(z.object({ id: z.string() })).query(({ input }) => {
      const found = templates.find((tpl) => tpl.id === input.id);
      if (!found) throw new Error("not found");
      return found;
    }),
    create: t.procedure.input(createAgentTemplateSchema).mutation(({ input }) => {
      const row: StoredTemplate = {
        id: `at_${++seq}`,
        name: input.name,
        type: input.type,
        fonosterAppRef: null,
        archivedAt: null
      };
      templates.push(row);
      return row;
    }),
    sync: t.procedure.input(syncAgentTemplateSchema).mutation(({ input }) => {
      const row = templates.find((tpl) => tpl.id === input.id);
      if (!row) throw new Error("not found");
      row.fonosterAppRef = `fn_app_${row.id}`;
      return row;
    })
  })
});

let server: Server;
let endpoint: string;

before(async () => {
  const app = express();
  app.use("/trpc", createExpressMiddleware({ router: appRouterStub }));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("failed to bind test server");
  endpoint = `http://localhost:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("golden path: create → list → get → sync", async () => {
  const client = new Client({ endpoint }).setTokens({ accessToken: "t" }).useWorkspace("ws_one");

  const created = await client.agentTemplates.create({
    type: "VOICE_AI",
    name: "Cobranza suave",
    voice: "sofia",
    systemPrompt: "Sé amable y directo.",
    language: "es"
  });
  assert.equal(created.type, "VOICE_AI");
  assert.equal(created.archivedAt, null);

  const list = await client.agentTemplates.list();
  assert.ok(list.some((tpl) => tpl.id === created.id));

  const fetched = await client.agentTemplates.get({ id: created.id });
  assert.equal(fetched.id, created.id);

  // `sync` (like the real apiserver procedure it wraps) returns only the base
  // template row, not its updated child config — the SDK doesn't fabricate a
  // richer shape than the server provides. Callers that need the resulting
  // `fonosterAppRef` re-fetch via `get`, which the CLI's `agents:eval` does.
  const synced = await client.agentTemplates.sync({ id: created.id });
  assert.equal(synced.id, created.id);
});
