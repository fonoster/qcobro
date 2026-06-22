import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCreateCampaign } from "./createCampaign.js";
import { ValidationError } from "@qcobro/common";

const VALID = {
  name: "Campaña Q3",
  agentTemplateId: "tmpl-1",
  portfolioIds: ["p1", "p2"],
  startDate: "2026-07-01",
  endDate: "2026-08-01",
  startTime: "09:00",
  endTime: "18:00",
  maxAttemptsPerAccount: 5,
  maxAttemptsPerDay: 2
};

function makeClient(templateWorkspace: string | null = "ws-1") {
  let createdCampaign: Record<string, unknown> | null = null;
  let portfolioLinks: Array<{ campaignId: string; portfolioId: string }> = [];

  const client = {
    agentTemplate: {
      findFirst: async () =>
        templateWorkspace
          ? ({ id: "tmpl-1", workspaceRef: templateWorkspace, type: "SMS" } as never)
          : null
    },
    campaign: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdCampaign = args.data;
        return { id: "camp-1", ...args.data } as never;
      }
    },
    campaignPortfolio: {
      createMany: async (args: { data: Array<{ campaignId: string; portfolioId: string }> }) => {
        portfolioLinks = args.data;
        return { count: args.data.length };
      }
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
  };

  return { client, stats: () => ({ createdCampaign, portfolioLinks }) };
}

describe("createCampaign", () => {
  it("creates a DRAFT campaign and links portfolios", async () => {
    const { client, stats } = makeClient("ws-1");
    const fn = createCreateCampaign(client as never, "ws-1");

    const result = await fn(VALID);

    assert.equal((result as { id: string }).id, "camp-1");
    assert.equal(stats().createdCampaign?.status, "DRAFT");
    assert.equal(stats().portfolioLinks.length, 2);
    assert.deepEqual(
      stats().portfolioLinks.map((l) => l.portfolioId),
      ["p1", "p2"]
    );
  });

  it("rejects an empty portfolio list", async () => {
    const { client } = makeClient("ws-1");
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ ...VALID, portfolioIds: [] }), ValidationError);
  });

  it("rejects a template from another workspace", async () => {
    const { client } = makeClient(null); // findFirst (scoped to ws-1) returns null
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn(VALID), ValidationError);
  });

  it("rejects an end date before the start date", async () => {
    const { client } = makeClient("ws-1");
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(
      () => fn({ ...VALID, startDate: "2026-08-01", endDate: "2026-07-01" }),
      ValidationError
    );
  });
});
