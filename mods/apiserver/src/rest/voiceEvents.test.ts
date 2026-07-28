import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createVoiceEventsHandler, type VoiceEventsDeps } from "./voiceEvents.js";

interface FakeLog {
  id: string;
  channelData: Record<string, unknown> | null;
  aiSummary: string | null;
}

function makePrisma(logs: Record<string, FakeLog>) {
  const updates: { id: string; data: unknown }[] = [];
  const prisma = {
    accountContactLog: {
      findFirst: async ({ where }: { where: { providerRef: string } }) => {
        const log = Object.values(logs).find((l) => l.id === where.providerRef);
        return log ? { id: log.id, channelData: log.channelData } : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const log = logs[where.id];
        if (!log) return null;
        return {
          id: log.id,
          aiSummary: log.aiSummary,
          channelData: log.channelData,
          portfolioAccount: { fullName: "Ana", outstandingBalance: 500, preferredLanguage: null }
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: unknown }) => {
        updates.push({ id: where.id, data });
        Object.assign(logs[where.id], data as object);
        return logs[where.id];
      }
    }
  };
  return { prisma, updates };
}

function makeRes() {
  const state = { statusCode: 0, body: undefined as unknown };
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

function makeDeps(
  over: Partial<VoiceEventsDeps> = {}
): VoiceEventsDeps & { decideCalls: string[] } {
  const decideCalls: string[] = [];
  return {
    generator: null,
    generation: "onDemand",
    decideOutcome: async (id: string) => {
      decideCalls.push(id);
      return { decided: true, outcome: null };
    },
    decideCalls,
    ...over
  };
}

describe("POST /api/voice/events — payment-promise decision wiring", () => {
  it("runs decideOutcome on conversation.ended for a matched gestión", async () => {
    const { prisma } = makePrisma({
      "log-1": { id: "log-1", channelData: null, aiSummary: null }
    });
    const deps = makeDeps();
    const handler = createVoiceEventsHandler(prisma as never, deps);
    const { res, state } = makeRes();

    await handler(
      {
        body: {
          eventType: "conversation.ended",
          appRef: "app-1",
          callRef: "log-1",
          phone: "+18091230001",
          chatHistory: [{ human: "Puedo pagar el viernes." }]
        }
      } as never,
      res as never
    );

    assert.equal(state.statusCode, 200);
    // Response is sent before the best-effort decision step runs.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(deps.decideCalls, ["log-1"]);
  });

  it("does not run decideOutcome on conversation.started", async () => {
    const { prisma } = makePrisma({
      "log-1": { id: "log-1", channelData: null, aiSummary: null }
    });
    const deps = makeDeps();
    const handler = createVoiceEventsHandler(prisma as never, deps);
    const { res } = makeRes();

    await handler(
      {
        body: { eventType: "conversation.started", appRef: "app-1", callRef: "log-1", phone: "+1" }
      } as never,
      res as never
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(deps.decideCalls, []);
  });

  it("does not run decideOutcome when no gestión matched the call ref", async () => {
    const { prisma } = makePrisma({});
    const deps = makeDeps();
    const handler = createVoiceEventsHandler(prisma as never, deps);
    const { res, state } = makeRes();

    await handler(
      {
        body: {
          eventType: "conversation.ended",
          appRef: "app-1",
          callRef: "unknown-ref",
          phone: "+1"
        }
      } as never,
      res as never
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(state.statusCode, 200);
    assert.deepEqual(deps.decideCalls, []);
  });

  it("a decideOutcome failure does not fail the webhook response", async () => {
    const { prisma } = makePrisma({
      "log-1": { id: "log-1", channelData: null, aiSummary: null }
    });
    const deps = makeDeps({
      decideOutcome: async () => {
        throw new Error("LLM exploded");
      }
    });
    const handler = createVoiceEventsHandler(prisma as never, deps);
    const { res, state } = makeRes();

    await handler(
      {
        body: {
          eventType: "conversation.ended",
          appRef: "app-1",
          callRef: "log-1",
          phone: "+1",
          chatHistory: [{ human: "Hola." }]
        }
      } as never,
      res as never
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(state.statusCode, 200);
  });
});
