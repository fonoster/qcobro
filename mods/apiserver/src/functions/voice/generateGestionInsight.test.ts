import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError, type GestionInsight, type InsightGenerator } from "@qcobro/common";
import { createGenerateGestionInsight } from "./generateGestionInsight.js";

const INSIGHT: GestionInsight = {
  aiSummary: "Resumen",
  aiSentiment: "POSITIVE",
  aiDebtReason: "Liquidez",
  aiResult: "Promesa de pago",
  aiNextStep: "Enviar enlace"
};

function makeGenerator() {
  const state = { calls: 0 };
  const generator: InsightGenerator = {
    async analyze() {
      state.calls++;
      return INSIGHT;
    }
  };
  return { generator, state };
}

function makeClient(record: {
  aiSummary: string | null;
  transcript?: { role: "agent" | "customer"; text: string }[];
}) {
  const cap: { updated?: Record<string, unknown> } = {};
  const prisma = {
    accountContactLog: {
      findUnique: async () => ({
        id: "g-1",
        aiSummary: record.aiSummary,
        channelData: record.transcript ? { transcript: record.transcript } : {},
        portfolioAccount: { fullName: "Ana", outstandingBalance: 4800, preferredLanguage: "es" }
      }),
      update: async (args: { data: Record<string, unknown> }) => {
        cap.updated = args.data;
        return {} as never;
      }
    }
  };
  return { prisma, cap };
}

const TRANSCRIPT = [
  { role: "agent" as const, text: "Buenas tardes." },
  { role: "customer" as const, text: "Hola." }
];

describe("generateGestionInsight", () => {
  it("generates and persists analysis for a transcript-bearing gestión", async () => {
    const { generator, state } = makeGenerator();
    const { prisma, cap } = makeClient({ aiSummary: null, transcript: TRANSCRIPT });

    const result = await createGenerateGestionInsight({ prisma: prisma as never, generator })({
      id: "g-1"
    });

    assert.deepEqual(result, { generated: true, insight: INSIGHT });
    assert.equal(state.calls, 1);
    assert.equal(cap.updated?.aiSummary, "Resumen");
    assert.equal(cap.updated?.aiSentiment, "POSITIVE");
  });

  it("skips when already analyzed (cached) without calling the LLM", async () => {
    const { generator, state } = makeGenerator();
    const { prisma, cap } = makeClient({ aiSummary: "ya", transcript: TRANSCRIPT });

    const result = await createGenerateGestionInsight({ prisma: prisma as never, generator })({
      id: "g-1"
    });

    assert.deepEqual(result, { generated: false, reason: "cached" });
    assert.equal(state.calls, 0);
    assert.equal(cap.updated, undefined);
  });

  it("skips when there is no transcript", async () => {
    const { generator, state } = makeGenerator();
    const { prisma, cap } = makeClient({ aiSummary: null });

    const result = await createGenerateGestionInsight({ prisma: prisma as never, generator })({
      id: "g-1"
    });

    assert.deepEqual(result, { generated: false, reason: "no_transcript" });
    assert.equal(state.calls, 0);
    assert.equal(cap.updated, undefined);
  });

  it("no-ops when insights are disabled (null generator)", async () => {
    const { prisma, cap } = makeClient({ aiSummary: null, transcript: TRANSCRIPT });
    const result = await createGenerateGestionInsight({ prisma: prisma as never, generator: null })(
      {
        id: "g-1"
      }
    );
    assert.deepEqual(result, { generated: false, reason: "disabled" });
    assert.equal(cap.updated, undefined);
  });

  it("rejects invalid input with a ValidationError before any work", async () => {
    const { generator, state } = makeGenerator();
    const { prisma } = makeClient({ aiSummary: null, transcript: TRANSCRIPT });
    await assert.rejects(
      () => createGenerateGestionInsight({ prisma: prisma as never, generator })({ id: "" }),
      (err) => err instanceof ValidationError
    );
    assert.equal(state.calls, 0);
  });
});
