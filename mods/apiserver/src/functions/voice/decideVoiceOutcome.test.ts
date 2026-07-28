import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EmailAutopilot, EmailAutopilotDecision } from "@qcobro/common";
import {
  createDecideVoiceOutcome,
  createPrismaVoiceDecisionClient,
  type VoiceDecisionClient,
  type VoiceDecisionGestionView
} from "./decideVoiceOutcome.js";

const NOW = () => new Date("2026-07-28T10:00:00Z");

function gestion(over: Partial<VoiceDecisionGestionView> = {}): VoiceDecisionGestionView {
  return {
    id: "log-1",
    portfolioAccountId: "acc-1",
    campaignId: "camp-1",
    debtAmountSnapshot: 500,
    providerRef: "call-ref-1",
    channelData: { transcript: [{ role: "customer", text: "Puedo pagar el viernes." }] },
    agentSystemPrompt: "Eres un agente de cobranza.",
    accountContext: { customerName: "Ana", outstandingBalance: 500 },
    ...over
  };
}

function harness(g: VoiceDecisionGestionView | null, decision: EmailAutopilotDecision) {
  const outcomes: Record<string, unknown>[] = [];
  const decideReqs: Record<string, unknown>[] = [];
  const client: VoiceDecisionClient = { loadById: async () => g };
  const autopilot: EmailAutopilot = {
    decide: async (req) => {
      decideReqs.push(req as unknown as Record<string, unknown>);
      return decision;
    }
  };
  const deps = {
    client,
    autopilot,
    recordOutcome: async (params: Record<string, unknown>) => {
      outcomes.push(params);
    },
    now: NOW
  };
  return { deps, outcomes, decideReqs };
}

describe("decideVoiceOutcome", () => {
  it("captures a payment promise via recordOutcome", async () => {
    const { deps, outcomes, decideReqs } = harness(gestion(), {
      action: "resolve",
      outcome: "PAYMENT_PROMISE",
      objective: { amount: 500, dueDate: "2026-08-01" }
    });
    const result = await createDecideVoiceOutcome(deps)("log-1");

    assert.deepEqual(result, { decided: true, outcome: "PAYMENT_PROMISE" });
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].agentType, "VOICE_AI");
    assert.equal(outcomes[0].providerRef, "call-ref-1");
    assert.equal(outcomes[0].outcome, "PAYMENT_PROMISE");
    assert.deepEqual(outcomes[0].intentMetadata, {
      promisedAmount: 500,
      promisedDate: "2026-08-01"
    });
    // Today's date is passed so the model can resolve relative promises ("el viernes").
    assert.equal(decideReqs[0].referenceDate, "2026-07-28");
  });

  it("records a non-payment outcome without an intentMetadata objective", async () => {
    const { deps, outcomes } = harness(gestion(), { action: "resolve", outcome: "WRONG_NUMBER" });
    const result = await createDecideVoiceOutcome(deps)("log-1");

    assert.deepEqual(result, { decided: true, outcome: "WRONG_NUMBER" });
    assert.equal(outcomes[0].outcome, "WRONG_NUMBER");
    assert.equal(outcomes[0].intentMetadata, undefined);
  });

  it("defaults an unrecognized outcome string to OTHER", async () => {
    const { deps, outcomes } = harness(gestion(), {
      action: "resolve",
      outcome: "SOMETHING_THE_MODEL_MADE_UP"
    });
    const result = await createDecideVoiceOutcome(deps)("log-1");

    assert.deepEqual(result, { decided: true, outcome: "OTHER" });
    assert.equal(outcomes[0].outcome, "OTHER");
  });

  it("records nothing when the decision carries no outcome", async () => {
    const { deps, outcomes } = harness(gestion(), { action: "resolve" });
    const result = await createDecideVoiceOutcome(deps)("log-1");

    assert.deepEqual(result, { decided: true, outcome: null });
    assert.equal(outcomes.length, 0);
  });

  it("skips the decision when the gestión has no transcript", async () => {
    const { deps, outcomes, decideReqs } = harness(gestion({ channelData: {} }), {
      action: "resolve",
      outcome: "PAYMENT_PROMISE"
    });
    const result = await createDecideVoiceOutcome(deps)("log-1");

    assert.deepEqual(result, { decided: false, reason: "no_transcript" });
    assert.equal(decideReqs.length, 0, "autopilot is never called");
    assert.equal(outcomes.length, 0);
  });

  it("returns not_found for an unknown gestión id", async () => {
    const { deps } = harness(null, { action: "resolve" });
    const result = await createDecideVoiceOutcome(deps)("missing");
    assert.deepEqual(result, { decided: false, reason: "not_found" });
  });
});

const ACCOUNT = {
  fullName: "Ana Pérez",
  outstandingBalance: 500,
  daysPastDue: 10,
  portfolio: { workspaceRef: "ws-1" }
};

/** Faked at the JS call-surface level (`as never`), matching how index.ts already casts
 *  `prisma` around every `createPrismaXxxClient` call in this codebase — the real
 *  `PrismaClient` type is not reproduced here, only the handful of methods actually used. */
function makeFakePrisma(row: {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  agentTemplateId: string | null;
  debtAmountSnapshot: number | null;
  providerRef: string | null;
  channelData: unknown;
  campaignVoiceSystemPrompt?: string;
  standaloneVoiceSystemPrompt?: string;
}) {
  return {
    accountContactLog: {
      findUnique: async () => ({
        id: row.id,
        portfolioAccountId: row.portfolioAccountId,
        campaignId: row.campaignId,
        agentTemplateId: row.agentTemplateId,
        debtAmountSnapshot: row.debtAmountSnapshot,
        providerRef: row.providerRef,
        channelData: row.channelData,
        campaign: row.campaignId
          ? {
              agentTemplate: row.campaignVoiceSystemPrompt
                ? { voiceAiConfig: { systemPrompt: row.campaignVoiceSystemPrompt } }
                : null
            }
          : null,
        portfolioAccount: ACCOUNT
      })
    },
    agentTemplate: {
      findUnique: async () =>
        row.standaloneVoiceSystemPrompt
          ? { voiceAiConfig: { systemPrompt: row.standaloneVoiceSystemPrompt } }
          : null
    },
    workspaceSettings: {
      findUnique: async () => ({ currency: "DOP" })
    }
  };
}

describe("createPrismaVoiceDecisionClient", () => {
  it("resolves agentSystemPrompt via campaign.agentTemplate for a campaign dispatch", async () => {
    const prisma = makeFakePrisma({
      id: "log-1",
      portfolioAccountId: "acc-1",
      campaignId: "camp-1",
      agentTemplateId: null,
      debtAmountSnapshot: 500,
      providerRef: "call-ref-1",
      channelData: { transcript: [] },
      campaignVoiceSystemPrompt: "Prompt de campaña."
    });
    const client = createPrismaVoiceDecisionClient(prisma as never);
    const view = await client.loadById("log-1");

    assert.equal(view?.agentSystemPrompt, "Prompt de campaña.");
    assert.equal(view?.accountContext.currency, "DOP");
  });

  it("falls back to a direct agentTemplateId lookup for an ad-hoc/follow-up dispatch", async () => {
    const prisma = makeFakePrisma({
      id: "log-2",
      portfolioAccountId: "acc-1",
      campaignId: null,
      agentTemplateId: "tmpl-1",
      debtAmountSnapshot: 500,
      providerRef: "call-ref-2",
      channelData: { transcript: [] },
      standaloneVoiceSystemPrompt: "Prompt de seguimiento ad-hoc."
    });
    const client = createPrismaVoiceDecisionClient(prisma as never);
    const view = await client.loadById("log-2");

    assert.equal(view?.agentSystemPrompt, "Prompt de seguimiento ad-hoc.");
  });

  it("returns null for an unknown gestión id", async () => {
    const prisma = {
      accountContactLog: { findUnique: async () => null },
      agentTemplate: { findUnique: async () => null },
      workspaceSettings: { findUnique: async () => null }
    };
    const client = createPrismaVoiceDecisionClient(prisma as never);
    assert.equal(await client.loadById("missing"), null);
  });
});
