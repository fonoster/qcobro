import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEngineEventsHandler,
  parseBasicApiKey,
  type EngineEventsConfig,
  type EngineEventsIdentity,
  type EngineEventsPrisma
} from "./engineEvents.js";

function basic(accessKeyId: string, accessKeySecret = "secret") {
  return "Basic " + Buffer.from(`${accessKeyId}:${accessKeySecret}`).toString("base64");
}

interface FakeRow {
  workspaceRef: string | null;
  kind: string;
  at: Date;
  seq: number;
  payload: unknown;
}

/** In-memory stand-in for the engine_events table, filtering like Postgres would. */
function makePrisma(rows: FakeRow[]): { prisma: EngineEventsPrisma; calls: number } {
  const state = { calls: 0 };
  const prisma: EngineEventsPrisma = {
    engineEvent: {
      findMany: async (args) => {
        state.calls += 1;
        const filtered = rows.filter((r) => {
          const orMatch = args.where.OR.some((cond) => {
            if (cond.workspaceRef === null) {
              return r.workspaceRef === null && cond.kind.in.includes(r.kind as never);
            }
            return r.workspaceRef === cond.workspaceRef;
          });
          if (!orMatch) return false;
          if (args.where.at?.gte && r.at < args.where.at.gte) return false;
          if (args.where.at?.lte && r.at > args.where.at.lte) return false;
          return true;
        });
        filtered.sort((a, b) => a.at.getTime() - b.at.getTime() || a.seq - b.seq);
        return filtered.map((r) => ({ payload: r.payload }));
      }
    }
  };
  return { prisma, calls: state.calls };
}

/** Stub Identity: two workspace keys, "bad-secret" fails, unknown ids fail. */
function makeIdentity(workspaceByKey: Record<string, string>): EngineEventsIdentity {
  return {
    exchangeApiKey: async (accessKeyId, accessKeySecret) => {
      if (!(accessKeyId in workspaceByKey) || accessKeySecret !== "secret") {
        throw new Error("invalid credentials");
      }
      return { accessToken: `token-for-${accessKeyId}` };
    },
    verifyToken: async (token) => {
      const accessKeyId = token.replace("token-for-", "");
      const workspaceRef = workspaceByKey[accessKeyId];
      if (!workspaceRef) return null;
      return { access: [{ accessKeyId: workspaceRef, role: "OWNER" }] };
    }
  };
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

const CONFIG: EngineEventsConfig = {
  engine: { tickSeconds: 60 },
  fonoster: { maxCallsPerMinute: 6 },
  twilio: { maxSmsPerMinute: 60 },
  resend: null,
  whatsapp: { maxMessagesPerMinute: 60 }
};

const ROWS: FakeRow[] = [
  {
    workspaceRef: null,
    kind: "TICK_STARTED",
    at: new Date("2026-07-11T10:00:00.000Z"),
    seq: 0,
    payload: { kind: "tick.started", id: "e0", at: "2026-07-11T10:00:00.000Z", tickId: "t1" }
  },
  {
    workspaceRef: "ws-1",
    kind: "CAMPAIGN_EVALUATED",
    at: new Date("2026-07-11T10:00:01.000Z"),
    seq: 1,
    payload: {
      kind: "campaign.evaluated",
      id: "e1",
      at: "2026-07-11T10:00:01.000Z",
      workspaceRef: "ws-1"
    }
  },
  {
    workspaceRef: "ws-2",
    kind: "CAMPAIGN_EVALUATED",
    at: new Date("2026-07-11T10:00:01.500Z"),
    seq: 2,
    payload: {
      kind: "campaign.evaluated",
      id: "e2",
      at: "2026-07-11T10:00:01.500Z",
      workspaceRef: "ws-2"
    }
  },
  {
    workspaceRef: null,
    kind: "TICK_COMPLETED",
    at: new Date("2026-07-11T10:00:02.000Z"),
    seq: 3,
    payload: { kind: "tick.completed", id: "e3", at: "2026-07-11T10:00:02.000Z", tickId: "t1" }
  },
  // Outside the range used below.
  {
    workspaceRef: "ws-1",
    kind: "CAMPAIGN_EVALUATED",
    at: new Date("2026-07-10T09:00:00.000Z"),
    seq: 0,
    payload: {
      kind: "campaign.evaluated",
      id: "e-old",
      at: "2026-07-10T09:00:00.000Z",
      workspaceRef: "ws-1"
    }
  }
];

describe("parseBasicApiKey", () => {
  it("extracts accessKeyId and accessKeySecret", () => {
    assert.deepEqual(parseBasicApiKey(basic("key-1", "s3cr3t")), {
      accessKeyId: "key-1",
      accessKeySecret: "s3cr3t"
    });
  });
  it("returns null for missing or malformed headers", () => {
    assert.equal(parseBasicApiKey(undefined), null);
    assert.equal(parseBasicApiKey("Bearer x"), null);
    assert.equal(parseBasicApiKey("Basic " + Buffer.from("nocolon").toString("base64")), null);
    assert.equal(parseBasicApiKey("Basic " + Buffer.from(":nokey").toString("base64")), null);
  });
});

describe("GET /api/engine/events handler", () => {
  it("returns only the key's workspace events plus deployment tick events, and the parameters", async () => {
    const { prisma } = makePrisma(ROWS);
    const identity = makeIdentity({ "key-1": "ws-1", "key-2": "ws-2" });
    const handler = createEngineEventsHandler(prisma, CONFIG, identity);
    const { res, state } = makeRes();

    await handler(
      {
        headers: { authorization: basic("key-1") },
        query: { from: "2026-07-11T00:00:00.000Z", to: "2026-07-11T23:59:59.000Z" }
      } as never,
      res as never
    );

    assert.equal(state.statusCode, 200);
    const body = state.body as { events: { id: string }[]; parameters: unknown };
    const ids = body.events.map((e) => e.id);
    assert.deepEqual(ids, ["e0", "e1", "e3"]);
    assert.deepEqual(body.parameters, {
      tickSeconds: 60,
      ratesPerMinute: { voice: 6, sms: 60, email: 0, whatsApp: 60 }
    });
  });

  it("never returns another workspace's events", async () => {
    const { prisma } = makePrisma(ROWS);
    const identity = makeIdentity({ "key-1": "ws-1", "key-2": "ws-2" });
    const handler = createEngineEventsHandler(prisma, CONFIG, identity);
    const { res, state } = makeRes();

    await handler({ headers: { authorization: basic("key-1") }, query: {} } as never, res as never);

    const body = state.body as { events: { workspaceRef?: string }[] };
    for (const e of body.events) {
      assert.notEqual(e.workspaceRef, "ws-2");
    }
  });

  it("rejects a missing Authorization header with 401 and no events", async () => {
    const { prisma, calls } = makePrisma(ROWS);
    const identity = makeIdentity({ "key-1": "ws-1" });
    const handler = createEngineEventsHandler(prisma, CONFIG, identity);
    const { res, state } = makeRes();

    await handler({ headers: {}, query: {} } as never, res as never);

    assert.equal(state.statusCode, 401);
    assert.equal(state.body && (state.body as { events?: unknown }).events, undefined);
    assert.equal(calls, 0);
  });

  it("rejects an invalid key pair with 401", async () => {
    const { prisma } = makePrisma(ROWS);
    const identity = makeIdentity({ "key-1": "ws-1" });
    const handler = createEngineEventsHandler(prisma, CONFIG, identity);
    const { res, state } = makeRes();

    await handler(
      { headers: { authorization: basic("key-1", "wrong-secret") }, query: {} } as never,
      res as never
    );

    assert.equal(state.statusCode, 401);
  });

  it("rejects an invalid 'from' with 400", async () => {
    const { prisma } = makePrisma(ROWS);
    const identity = makeIdentity({ "key-1": "ws-1" });
    const handler = createEngineEventsHandler(prisma, CONFIG, identity);
    const { res, state } = makeRes();

    await handler(
      {
        headers: { authorization: basic("key-1") },
        query: { from: "not-a-date" }
      } as never,
      res as never
    );

    assert.equal(state.statusCode, 400);
  });
});
