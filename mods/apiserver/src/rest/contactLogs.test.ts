import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContactLogHandler, parseBasicWorkspace } from "./contactLogs.js";

function basic(user: string, pass = "secret") {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

/** Fake Prisma resolving accounts to their owning workspace + a no-op write path. */
function makePrisma(accountWorkspace: Record<string, string>) {
  const prisma: Record<string, unknown> = {
    portfolioAccount: {
      findUnique: async (args: { where: { id: string } }) => {
        const ws = accountWorkspace[args.where.id];
        return ws ? { portfolio: { workspaceRef: ws } } : null;
      },
      update: async () => ({ id: "acc" })
    },
    accountContactLog: {
      create: async (args: { data: Record<string, unknown> }) => ({ id: "log-1", ...args.data })
    }
  };
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return prisma;
}

function makeRes() {
  const state = { statusCode: 200, body: undefined as unknown };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    }
  };
  return { res, state };
}

const PAYLOAD = {
  portfolioAccountId: "acc-1",
  agentType: "SMS",
  contactedAt: "2026-06-22T10:00:00.000Z",
  outcome: "NO_ANSWER"
};

describe("parseBasicWorkspace", () => {
  it("extracts the username as the workspace ref", () => {
    assert.equal(parseBasicWorkspace(basic("ws-1")), "ws-1");
  });
  it("returns null for missing or malformed headers", () => {
    assert.equal(parseBasicWorkspace(undefined), null);
    assert.equal(parseBasicWorkspace("Bearer x"), null);
    assert.equal(
      parseBasicWorkspace("Basic " + Buffer.from("nopassword").toString("base64")),
      null
    );
  });
});

describe("POST /api/contact-logs handler", () => {
  it("bypasses auth when contactLogAuth is disabled", async () => {
    const prisma = makePrisma({ "acc-1": "ws-1" });
    const handler = createContactLogHandler(prisma as never, {
      apiserver: { contactLogAuth: { enabled: false } }
    });
    const { res, state } = makeRes();

    await handler({ headers: {}, body: PAYLOAD } as never, res as never);

    assert.equal(state.statusCode, 201);
  });

  it("accepts valid workspace credentials", async () => {
    const prisma = makePrisma({ "acc-1": "ws-1" });
    const handler = createContactLogHandler(prisma as never, {
      apiserver: { contactLogAuth: { enabled: true } }
    });
    const { res, state } = makeRes();

    await handler(
      { headers: { authorization: basic("ws-1") }, body: PAYLOAD } as never,
      res as never
    );

    assert.equal(state.statusCode, 201);
  });

  it("rejects missing credentials with 401 when enabled", async () => {
    const prisma = makePrisma({ "acc-1": "ws-1" });
    const handler = createContactLogHandler(prisma as never, {
      apiserver: { contactLogAuth: { enabled: true } }
    });
    const { res, state } = makeRes();

    await handler({ headers: {}, body: PAYLOAD } as never, res as never);

    assert.equal(state.statusCode, 401);
  });

  it("rejects a payload referencing a different workspace", async () => {
    const prisma = makePrisma({ "acc-1": "ws-2" }); // account belongs to ws-2
    const handler = createContactLogHandler(prisma as never, {
      apiserver: { contactLogAuth: { enabled: true } }
    });
    const { res, state } = makeRes();

    await handler(
      { headers: { authorization: basic("ws-1") }, body: PAYLOAD } as never,
      res as never
    );

    assert.equal(state.statusCode, 401);
  });
});
