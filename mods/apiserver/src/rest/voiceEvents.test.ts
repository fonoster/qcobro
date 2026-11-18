import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Webhooks } from "@fonoster/common";
import type {
  Delivery,
  DeliveryReason,
  EmailAutopilotDecision,
  EmailAutopilotRequest,
  GestionInsight
} from "@qcobro/common";
import { createVoiceEventsHandler, type VoiceEventsDeps } from "./voiceEvents.js";
import { createRecordVoiceAiCallStatus } from "../functions/voice/recordVoiceAiCallStatus.js";
import { createDecideVoiceOutcome } from "../functions/voice/decideVoiceOutcome.js";
import { createVoiceAiDecisionRecovery } from "../functions/voice/voiceAiDecisionRecovery.js";

const SECRET = "whsec_3b1f0c9d2e";
const WORKSPACE = "WO00000000000000000000000000000000";
const DISPATCHED_AT = new Date("2026-11-17T14:00:00.000Z");

interface Row {
  id: string;
  providerRef: string;
  agentType: "VOICE_AI" | "VOICE_PRERECORDED";
  delivery: Delivery;
  deliveryReason: DeliveryReason | null;
  path: string | null;
  outcome: string | null;
  durationSeconds: number | null;
  channelData: Record<string, unknown> | null;
  aiSummary: string | null;
  contactedAt: Date;
}

/** One persisted world, shared by handler instances to model a process restart. */
function makeWorld(rows: Partial<Row>[]) {
  const db: Row[] = rows.map((r, i) => ({
    id: `log-${i + 1}`,
    providerRef: `call-${i + 1}`,
    agentType: "VOICE_AI",
    delivery: "DISPATCHED",
    deliveryReason: null,
    path: null,
    outcome: null,
    durationSeconds: null,
    channelData: null,
    aiSummary: null,
    contactedAt: DISPATCHED_AT,
    ...r
  }));
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v);
  const counts = {
    settled: [] as { providerRef: string; answeredSeconds: number }[],
    insights: 0,
    insightTranscripts: [] as unknown[],
    decisions: [] as EmailAutopilotRequest[],
    prerecorded: [] as unknown[]
  };
  const settledRefs = new Set<string>();

  const prisma = {
    accountContactLog: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = db.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = db.find((r) => r.id === where.id);
        return row
          ? {
              ...row,
              portfolioAccount: {
                fullName: "Ana",
                outstandingBalance: 500,
                preferredLanguage: null
              }
            }
          : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const hit = db.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        db
          .filter(
            (r) =>
              r.agentType === where.agentType &&
              r.path === null &&
              typeof r.channelData?.transcriptStoredAt === "string"
          )
          .map((r) => ({ id: r.id, channelData: r.channelData }))
    }
  };

  let generatorMode: "ok" | "throw" | "hang" = "ok";
  const generator = {
    analyze: async (req: { transcript: unknown }): Promise<GestionInsight> => {
      if (generatorMode === "throw") throw new Error("LLM unavailable");
      if (generatorMode === "hang") return new Promise<never>(() => undefined);
      counts.insights++;
      counts.insightTranscripts.push(req.transcript);
      return {
        aiSummary: "Promete pagar el viernes",
        aiSentiment: "POSITIVE",
        aiDebtReason: null,
        aiResult: null,
        aiNextStep: null
      };
    }
  };

  const decideOutcome = createDecideVoiceOutcome({
    client: {
      loadById: async (id: string) => {
        const row = db.find((r) => r.id === id);
        return row
          ? {
              id: row.id,
              portfolioAccountId: "acct-1",
              campaignId: null,
              debtAmountSnapshot: null,
              providerRef: row.providerRef,
              path: row.path,
              channelData: row.channelData,
              agentSystemPrompt: "",
              accountContext: {}
            }
          : null;
      }
    },
    autopilot: {
      decide: async (req: EmailAutopilotRequest): Promise<EmailAutopilotDecision> => {
        counts.decisions.push(req);
        return { action: "resolve", outcome: "PAYMENT_PROMISE", objective: null };
      }
    },
    recordOutcome: async (params) => {
      const row = db.find((r) => r.providerRef === params.providerRef)!;
      row.path = params.path ?? row.path;
      row.outcome = params.outcome ?? row.outcome;
    },
    now: () => new Date()
  });

  const records: Record<string, unknown> = {};
  const failingRecords = new Set<string>();
  const callRecords = {
    getRecordCalls: 0,
    getRecord: async (callRef: string) => {
      callRecords.getRecordCalls++;
      if (failingRecords.has(callRef)) throw new Error("records API: 502 bad_gateway");
      const record = records[callRef];
      if (!record) throw new Error("records API: 404 not_found");
      return record as never;
    }
  };

  function deps(over: Partial<VoiceEventsDeps> = {}): VoiceEventsDeps {
    return {
      webhookSecret: SECRET,
      callRecords,
      generator,
      generation: "onIngestion",
      settleUsage: async (input) => {
        if (settledRefs.has(input.providerRef)) return null;
        settledRefs.add(input.providerRef);
        counts.settled.push({
          providerRef: input.providerRef,
          answeredSeconds: input.answeredSeconds
        });
        return {};
      },
      recordVoiceAiCallStatus: createRecordVoiceAiCallStatus(prisma as never),
      recordPrerecordedOutcome: async (input) => {
        counts.prerecorded.push(input);
      },
      decideOutcome,
      ...over
    };
  }

  return {
    db,
    prisma,
    counts,
    records,
    failingRecords,
    callRecords,
    deps,
    setGenerator: (mode: typeof generatorMode) => (generatorMode = mode),
    generator,
    decideOutcome,
    handler: (over: Partial<VoiceEventsDeps> = {}) =>
      createVoiceEventsHandler(prisma as never, deps(over))
  };
}

function vconRecord(turns: [0 | 2, string][], withRecording = true) {
  return {
    callRef: "x",
    currentVersion: 1,
    redacted: true,
    vcon: {
      parties: [
        { tel: "18297340812", role: "caller" },
        { tel: "18095550123", role: "callee" },
        { name: "app-1", role: "agent" }
      ],
      dialog: [
        ...(withRecording ? [{ type: "recording", url: "parts/call.wav" }] : []),
        ...turns.map(([p, body]) => ({ type: "text", parties: [p], originator: p, body }))
      ],
      fonoster: {}
    }
  };
}

const ended = (callRef: string, durationSeconds = 83) =>
  Webhooks.callEnded(WORKSPACE, {
    callRef,
    appRef: "app-1",
    from: "18297340812",
    to: "18095550123",
    direction: "outbound",
    durationSeconds,
    endReason: "caller_hangup"
  });
const failed = (callRef: string, reason: string) =>
  Webhooks.callFailed(WORKSPACE, {
    callRef,
    appRef: "app-1",
    from: "18297340812",
    to: "18095550123",
    direction: "outbound",
    reason
  });
const sealed = (callRef: string, version = 1) =>
  Webhooks.callRecordSealed(WORKSPACE, { callRef, version, recordUrl: `records/${callRef}` });

async function post(
  handler: ReturnType<typeof createVoiceEventsHandler>,
  event: unknown,
  opts: { secrets?: string[]; timestamp?: number; headers?: Record<string, string> } = {}
) {
  const raw = JSON.stringify(event);
  const signed = Webhooks.webhookHeaders(
    raw,
    opts.secrets ?? [SECRET],
    opts.timestamp ?? Math.floor(Date.now() / 1000)
  );
  const headers = Object.fromEntries(
    Object.entries(opts.headers ?? signed).map(([k, v]) => [k.toLowerCase(), v])
  );
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
  await handler({ body: Buffer.from(raw), headers } as never, res as never);
  return state;
}

/** Lets the work the receiver runs after its response finish. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

const CONVERSATION: [0 | 2, string][] = [
  [2, "Hola, le llamo de parte de Credifácil."],
  [0, "Sí, dígame."],
  [2, "¿Puede pagar la cuota?"],
  [0, "Puedo pagar el viernes."]
];

describe("POST /api/voice/events — signature", () => {
  it("accepts a delivery signed with the configured secret", async () => {
    const w = makeWorld([{}]);
    const state = await post(w.handler(), ended("call-1"));
    assert.equal(state.statusCode, 200);
  });

  const rejected: [
    string,
    { secrets?: string[]; timestamp?: number; headers?: Record<string, string> }
  ][] = [
    ["a wrong signature", { secrets: ["whsec_wrong"] }],
    ["a missing signature header", { headers: {} }],
    ["a timestamp more than 300 s off", { timestamp: Math.floor(Date.now() / 1000) - 301 }]
  ];
  for (const [name, opts] of rejected) {
    it(`rejects ${name} with 401 and runs no side effect`, async () => {
      const w = makeWorld([{ channelData: null }]);
      w.records["call-1"] = vconRecord(CONVERSATION);
      const handler = w.handler();

      const a = await post(handler, ended("call-1"), opts);
      const b = await post(handler, sealed("call-1"), opts);
      await flush();

      assert.equal(a.statusCode, 401);
      assert.equal(b.statusCode, 401);
      assert.equal(w.db[0].delivery, "DISPATCHED");
      assert.equal(w.counts.settled.length, 0);
      assert.equal(w.counts.insights, 0);
      assert.equal(w.counts.decisions.length, 0);
      assert.equal(w.callRecords.getRecordCalls, 0);
    });
  }

  it("accepts a rotation header where one of two signatures is valid", async () => {
    const w = makeWorld([{}]);
    const state = await post(w.handler(), ended("call-1"), { secrets: ["whsec_old", SECRET] });
    assert.equal(state.statusCode, 200);
    assert.equal(w.db[0].delivery, "DELIVERED");
  });

  it("answers 503 when fonoster.webhookSecret is not set", async () => {
    const w = makeWorld([{}]);
    const state = await post(w.handler({ webhookSecret: null }), ended("call-1"));
    assert.equal(state.statusCode, 503);
    assert.equal(w.db[0].delivery, "DISPATCHED");
  });
});

describe("POST /api/voice/events — VOICE_AI results", () => {
  it("call.ended finalizes DELIVERED with the event's duration and settles usage", async () => {
    const w = makeWorld([{}]);
    await post(w.handler(), ended("call-1", 83));

    assert.equal(w.db[0].delivery, "DELIVERED");
    assert.equal(w.db[0].durationSeconds, 83);
    assert.deepEqual(w.counts.settled, [{ providerRef: "call-1", answeredSeconds: 83 }]);
  });

  for (const order of ["sealed first", "ended first"] as const) {
    it(`ends DELIVERED with one insight, one decision and one settlement (${order})`, async () => {
      const w = makeWorld([{}]);
      w.records["call-1"] = vconRecord(CONVERSATION);
      const handler = w.handler();
      const events =
        order === "sealed first"
          ? [sealed("call-1"), ended("call-1", 83)]
          : [ended("call-1", 83), sealed("call-1")];

      for (const e of events) {
        assert.equal((await post(handler, e)).statusCode, 200);
        await flush();
      }

      assert.equal(w.db[0].delivery, "DELIVERED");
      assert.equal(w.counts.insights, 1);
      assert.equal(w.counts.decisions.length, 1);
      assert.deepEqual(w.counts.settled, [{ providerRef: "call-1", answeredSeconds: 83 }]);
      assert.equal(w.db[0].outcome, "PAYMENT_PROMISE");
    });
  }

  it("runs each side effect once when the same events are redelivered, across a restart", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    const e1 = ended("call-1", 83);
    const e2 = sealed("call-1");

    for (const handler of [w.handler(), w.handler()]) {
      for (const e of [e1, e2, e1, e2]) {
        assert.equal((await post(handler, e)).statusCode, 200);
        await flush();
      }
    }

    assert.equal(w.db[0].delivery, "DELIVERED");
    assert.equal(w.counts.settled.length, 1);
    assert.equal(w.counts.insights, 1);
    assert.equal(w.counts.decisions.length, 1);
  });

  it("does not run insight or decision again for a version 2 record of a decided call", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    const handler = w.handler();
    await post(handler, sealed("call-1", 1));
    await flush();

    const state = await post(handler, sealed("call-1", 2));
    await flush();

    assert.equal(state.statusCode, 200);
    assert.equal(w.counts.insights, 1);
    assert.equal(w.counts.decisions.length, 1);
  });

  it("hands insight and decision the record's turns as customer/agent in order", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    await post(w.handler(), sealed("call-1"));
    await flush();

    const expected = [
      { role: "agent", text: "Hola, le llamo de parte de Credifácil." },
      { role: "customer", text: "Sí, dígame." },
      { role: "agent", text: "¿Puede pagar la cuota?" },
      { role: "customer", text: "Puedo pagar el viernes." }
    ];
    assert.deepEqual(w.counts.insightTranscripts[0], expected);
    assert.deepEqual(
      w.counts.decisions[0].thread.map((m) => [m.direction, m.body]),
      [
        ["outbound", "Hola, le llamo de parte de Credifácil."],
        ["inbound", "Sí, dígame."],
        ["outbound", "¿Puede pagar la cuota?"],
        ["inbound", "Puedo pagar el viernes."]
      ]
    );
  });

  it("produces no outcome for a record with no text turns", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord([]);
    const state = await post(w.handler(), sealed("call-1"));
    await flush();

    assert.equal(state.statusCode, 200);
    assert.equal(w.counts.decisions.length, 0);
    assert.equal(w.db[0].outcome, null);
  });

  it("answers 500 when the record fetch fails, and handles a later redelivery", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    w.failingRecords.add("call-1");
    const handler = w.handler();
    const event = sealed("call-1");

    const first = await post(handler, event);
    await flush();
    assert.equal(first.statusCode, 500);
    assert.equal(w.db[0].channelData?.transcript, undefined);
    assert.equal(w.counts.decisions.length, 0);

    w.failingRecords.delete("call-1");
    const second = await post(handler, event);
    await flush();
    assert.equal(second.statusCode, 200);
    assert.equal(w.counts.decisions.length, 1);
  });

  it("answers within 10 s even when the insight generator never resolves", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    w.setGenerator("hang");
    const started = Date.now();

    const state = await Promise.race([
      post(w.handler(), sealed("call-1")),
      new Promise<{ statusCode: number }>((r) => setTimeout(() => r({ statusCode: -1 }), 10_000))
    ]);

    assert.equal(state.statusCode, 200);
    assert.ok(Date.now() - started < 10_000);
    // The transcript is persisted before the response, so the sweep owns the rest.
    assert.ok(Array.isArray(w.db[0].channelData?.transcript));
  });

  it("answers 500 when the record fetch hangs past its budget", async () => {
    const w = makeWorld([{}]);
    const handler = createVoiceEventsHandler(
      w.prisma as never,
      w.deps({
        callRecords: { getRecord: () => new Promise<never>(() => undefined) },
        recordFetchTimeoutMs: 20
      })
    );

    const state = await post(handler, sealed("call-1"));
    assert.equal(state.statusCode, 500);
  });
});

describe("POST /api/voice/events — call.failed", () => {
  const table: [string, DeliveryReason][] = [
    ["busy", "BUSY"],
    ["no_answer", "NO_ANSWER"],
    ["rejected", "REJECTED"],
    ["app_unreachable", "PROVIDER_ERROR"],
    ["node_error", "PROVIDER_ERROR"],
    ["removed", "OUTCOME_UNKNOWN"],
    ["carrier_exploded", "OUTCOME_UNKNOWN"]
  ];

  for (const [reason, expected] of table) {
    it(`finalizes FAILED/${expected} for ${reason} and nets usage to zero`, async () => {
      const w = makeWorld([{}]);
      const state = await post(w.handler(), failed("call-1", reason));

      assert.equal(state.statusCode, 200);
      assert.equal(w.db[0].delivery, "FAILED");
      assert.equal(w.db[0].deliveryReason, expected);
      assert.deepEqual(w.counts.settled, [{ providerRef: "call-1", answeredSeconds: 0 }]);
    });
  }

  it("finalizes a pre-recorded gestión through its own recorder", async () => {
    const w = makeWorld([{ agentType: "VOICE_PRERECORDED" }]);
    await post(w.handler(), failed("call-1", "busy"));

    assert.equal(w.counts.prerecorded.length, 1);
    assert.equal((w.counts.prerecorded[0] as { deliveryReason: string }).deliveryReason, "BUSY");
  });
});

describe("POST /api/voice/events — pre-recorded and unknown calls", () => {
  it("acknowledges call.ended and call_record.sealed for a pre-recorded gestión without touching it", async () => {
    const w = makeWorld([
      {
        agentType: "VOICE_PRERECORDED",
        delivery: "DELIVERED",
        path: "ENGAGED",
        channelData: { scriptCompleted: true }
      }
    ]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    const before = structuredClone(w.db[0]);
    const handler = w.handler();

    assert.equal((await post(handler, ended("call-1"))).statusCode, 200);
    assert.equal((await post(handler, sealed("call-1"))).statusCode, 200);
    await flush();

    assert.deepEqual(w.db[0], before);
    assert.equal(w.counts.insights, 0);
    assert.equal(w.counts.decisions.length, 0);
    assert.equal(w.counts.prerecorded.length, 0);
    assert.equal(w.callRecords.getRecordCalls, 0);
  });

  it("acknowledges events for an unknown callRef", async () => {
    const w = makeWorld([]);
    const handler = w.handler();
    for (const e of [ended("nope"), sealed("nope"), failed("nope", "busy")]) {
      assert.equal((await post(handler, e)).statusCode, 200);
    }
    assert.equal(w.counts.settled.length, 0);
  });

  it("acknowledges call.started and provider.deprecated", async () => {
    const w = makeWorld([{}]);
    const handler = w.handler();
    const started = Webhooks.callStarted(WORKSPACE, {
      callRef: "call-1",
      appRef: "app-1",
      from: "1",
      to: "2",
      direction: "outbound"
    });
    const deprecated = Webhooks.providerDeprecated(WORKSPACE, {
      id: "tts.old",
      replacement: "tts.new",
      retireOn: "2027-01-01"
    });
    assert.equal((await post(handler, started)).statusCode, 200);
    assert.equal((await post(handler, deprecated)).statusCode, 200);
    assert.equal(w.db[0].delivery, "DISPATCHED");
  });
});

describe("voice AI decision recovery (the sweep's backstop for owed work)", () => {
  function recovery(w: ReturnType<typeof makeWorld>, now: Date) {
    return createVoiceAiDecisionRecovery({
      client: w.prisma as never,
      generator: w.generator,
      generation: "onIngestion",
      decideOutcome: w.decideOutcome,
      graceMinutes: 2,
      now: () => now
    });
  }

  it("runs insight and decision exactly once on the next sweep after the generator threw", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    w.setGenerator("throw");
    const state = await post(w.handler(), sealed("call-1"));
    await flush();
    assert.equal(state.statusCode, 200);
    assert.equal(w.counts.decisions.length, 0);

    w.setGenerator("ok");
    const recover = recovery(w, new Date(Date.now() + 10 * 60_000));

    assert.equal(await recover(), 1);
    assert.equal(await recover(), 0);
    assert.equal(w.counts.insights, 1);
    assert.equal(w.counts.decisions.length, 1);
  });

  it("leaves a transcript stored moments ago to the receiver still working on it", async () => {
    const w = makeWorld([{}]);
    w.records["call-1"] = vconRecord(CONVERSATION);
    w.setGenerator("throw");
    await post(w.handler(), sealed("call-1"));
    await flush();

    assert.equal(await recovery(w, new Date())(), 0);
    assert.equal(w.counts.decisions.length, 0);
  });
});
